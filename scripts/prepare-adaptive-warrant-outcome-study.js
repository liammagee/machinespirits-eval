#!/usr/bin/env node

/**
 * Zero-call A1 material preparation for the registered warrant outcome study.
 * This module reads local source and writes deterministic material only. It has
 * no provider, child-process, or model-call path.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse } from 'acorn';
import yaml from 'yaml';

import {
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES,
} from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';
import { recordObservedDigest } from '../services/recordedFileDigest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTCOME_A1_MENU_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-standing-permission-menu.v1';

export const OUTCOME_A1_SOURCE_PINS = Object.freeze({
  'services/tutorStubWarrantGate.js': 'db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24',
  'services/adaptiveWarrantPolicy.js': '8e17f23bab13270b83a10597ca820b08607b42e6757640c23b70dab25bf60837',
  'services/tutorStubFirstDraftContract.js': '868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29',
  'services/tutorStubQuestionSupport.js': '6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3',
  'config/engagement-registers.yaml': '6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2',
});

export const OUTCOME_A1_ENUMERATION_RULE = Object.freeze({
  rendered_layer:
    'Starting from tutorStubFirstDraftContractPrompt, enumerate every candidate fixed string that can flow into a rendered field from the SHA-pinned services/tutorStubFirstDraftContract.js, then apply ruling 060b per string: identify its switching variable, trace whether the gate verdict, repair policy, or register selection can reach that variable, and include the string if and only if the trace is reachable. Sweep every part, tactic, stance, action, and support cue mechanically without reachability pruning inside those gate-varying families; exclude strings switched only by learner wording, learner state, question-support state, source state, or progression bookkeeping that the gate decision path cannot change.',
  templates:
    'For a compact template, quote every fixed segment byte-for-byte in source order and show each interpolated public-contract value as a named {{slot}}; the descriptive prefix states that the gate fills those slots from the public contract, and the drift guard compares the fixed_segments array byte-for-byte.',
  question_support:
    'Do not include buildTutorStubQuestionSupport tutorInstruction strings: they populate the detailed contract ending.instruction field, but the live compact host-plan renderer does not read that field. Classify the compact question-support-dependent strings individually: responsive-repair, bounded-choice, and clarification additions are OUT because their upstream question-support switches are unreachable; question-boundary strings remain IN because gate-selected action family and public-obligation state reach progression.handoff_contract.question_allowed.',
  membership_test:
    'A candidate string is IN exactly when its switching variable is reachable from the gate verdict, repair policy, or register selection. An unreachable switch is OUT even when the string is prompt-reaching. A doubtful trace stays IN and records the doubt.',
  null_branch:
    'compactSupportInstruction support level zero or unset returns the empty string. It injects no words, so tactic.support.0 is documented as a null branch and is not a menu entry.',
});

export const OUTCOME_PILOT_SEEDS = Object.freeze([515, 516, 517]);

/**
 * The guarded main block's seeds, registered by relay 117 §11 after the range
 * first proposed there, 530-541, failed the freshness check: six of those are
 * the passive main block's own and one is a drama-derivation seed. Frozen here
 * for the same reason the pilot's three are — the manifest states them, and
 * code checks the manifest rather than trusting it.
 */
export const OUTCOME_GUARDED_MAIN_BLOCK_SEEDS = Object.freeze(
  Array.from({ length: 12 }, (_unused, index) => 654 + index),
);

/** Two worlds and three conditions per seed, eight turns per dialogue. */
const OUTCOME_WORLDS_PER_SEED = 2;
const OUTCOME_CONDITIONS_PER_WORLD = 3;
const OUTCOME_TURNS_PER_DIALOGUE = 8;
const OUTCOME_READERS_PER_CHANNEL = 2;
export const OUTCOME_PER_DIALOGUE_GENERATION_CAP = 30;

function buildOutcomeRunShape(name, seeds, { presenceReadersFielded = true } = {}) {
  const dialogues = seeds.length * OUTCOME_WORLDS_PER_SEED * OUTCOME_CONDITIONS_PER_WORLD;
  const cases = dialogues * OUTCOME_TURNS_PER_DIALOGUE;
  const readerCalls = cases * OUTCOME_READERS_PER_CHANNEL;
  const generation = dialogues * OUTCOME_PER_DIALOGUE_GENERATION_CAP;
  return Object.freeze({
    name,
    seeds,
    dialogues,
    turns_per_dialogue: OUTCOME_TURNS_PER_DIALOGUE,
    cases,
    readers_per_channel: OUTCOME_READERS_PER_CHANNEL,
    per_dialogue_generation_cap: OUTCOME_PER_DIALOGUE_GENERATION_CAP,
    presence_readers_fielded: presenceReadersFielded,
    // The plan keeps its presence line even where the channel is not fielded.
    // The plan is a ceiling, not an order to spend: the budget refuses at the
    // total, and an unspent line leaves head room. Dropping the line here would
    // move the sealed total, and the manifest and every go note quote it.
    planned_calls: Object.freeze({
      generation,
      presence_readers: readerCalls,
      decision_readers: readerCalls,
      total: generation + readerCalls + readerCalls,
    }),
  });
}

/**
 * The two run sizes the outcome driver will read. Every count below is derived
 * from the seed list, so a shape cannot disagree with itself. The pilot shape
 * reproduces the frozen pilot manifest exactly: 18 dialogues, 144 cases,
 * 540 + 288 + 288 = 1116 calls.
 */
export const OUTCOME_RUN_SHAPES = Object.freeze({
  pilot: buildOutcomeRunShape('pilot', OUTCOME_PILOT_SEEDS),
  // Re-registration 096, amendment 2: the main block runs the decision channel
  // only. The presence readers measure M7 and M8, which that amendment demotes
  // to report only, so re-fielding them would spend about 1,200 paid calls on
  // an instrument that carries no weight. M7 and M8 are described zero call
  // from the stored generation-time events and labelled not reader-validated.
  'main-block': buildOutcomeRunShape('main-block', OUTCOME_GUARDED_MAIN_BLOCK_SEEDS, {
    presenceReadersFielded: false,
  }),
});

export const OUTCOME_DEFAULT_RUN_SHAPE = OUTCOME_RUN_SHAPES.pilot;

/**
 * The order the three conditions run in, world by world and seed by seed.
 *
 * The rotation steps once per world visited, so no condition sits in the same
 * slot twice running. This is the guarded pilot's own rule, and it reproduces
 * the frozen 18 rows exactly; the passive main block used a different rule
 * (rotation by seed index plus world index), and the two are not mixed.
 */
export function buildOutcomeInterleavedAssignment({ shape = OUTCOME_DEFAULT_RUN_SHAPE, worldIds } = {}) {
  if (!Array.isArray(worldIds) || worldIds.length !== OUTCOME_WORLDS_PER_SEED) {
    throw new Error(`interleaved assignment needs exactly ${OUTCOME_WORLDS_PER_SEED} world ids`);
  }
  const conditions = ['bare', 'gated', 'standing_permission'];
  const rows = [];
  let visit = 0;
  for (const seed of shape.seeds) {
    for (const world of worldIds) {
      const rotation = visit % conditions.length;
      visit += 1;
      for (let offset = 0; offset < conditions.length; offset += 1) {
        rows.push({
          order: rows.length + 1,
          world,
          seed,
          condition: conditions[(rotation + offset) % conditions.length],
        });
      }
    }
  }
  if (rows.length !== shape.dialogues) {
    throw new Error(`interleaved assignment produced ${rows.length} rows, not ${shape.dialogues}`);
  }
  return rows;
}

/** A manifest that names no shape is a pilot manifest, as every sealed one is. */
export function resolveOutcomeRunShape(name) {
  if (name === null || name === undefined) return OUTCOME_DEFAULT_RUN_SHAPE;
  const shape = OUTCOME_RUN_SHAPES[name];
  if (!shape) {
    throw new Error(
      `unknown outcome run shape: ${name}; expected one of ${Object.keys(OUTCOME_RUN_SHAPES).join(', ')}`,
    );
  }
  return shape;
}

export const OUTCOME_PILOT_EXCLUDED_ARTIFACTS = Object.freeze([
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/validation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-contract-validation-v1-live-2026-08-10/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-mechanism-live-5ddf1d28/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-3ba68de5/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-d2bf37c7/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-7df153d9/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-record-entry-supplement-006-225a7b07/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-d72931bf-s504/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-a4529e79-s505/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-fe2d7a2f-s506/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-bc707cd0-s507/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-0897d030-s508/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-96bada6e-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-39757d4e-sonnet/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-2e90d863-s508-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-6cbbb8c3-s509-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-e34fb6de-s509-luna-block2/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-e34fb6de-s509-luna-block3/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-sample.blinded.json',
]);
export const OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES = Object.freeze([
  'gate-smoke/2026-08-09T15-08-12-726Z.jsonl',
  'heldout-borderline/2026-08-09T14-32-40-999Z.jsonl',
  'heldout-validation/2026-08-09T14-50-26-266Z.jsonl',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value, visit);
  }
}

function objectLiteralMap(sourceText, constantName) {
  const ast = parse(sourceText, { ecmaVersion: 'latest', sourceType: 'module' });
  let objectExpression = null;
  walk(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.name !== constantName) return;
    objectExpression = node.init?.type === 'CallExpression' ? node.init.arguments?.[0] : node.init;
  });
  if (objectExpression?.type !== 'ObjectExpression') throw new Error(`missing object constant ${constantName}`);
  return Object.fromEntries(
    objectExpression.properties.map((property) => {
      const key = property.key?.name ?? property.key?.value;
      if (typeof key !== 'string' || property.value?.type !== 'Literal' || typeof property.value.value !== 'string') {
        throw new Error(`${constantName} contains a non-literal entry`);
      }
      return [key, property.value.value];
    }),
  );
}

function functionObjectLiteralMap(sourceText, functionName, constantName) {
  const ast = parse(sourceText, { ecmaVersion: 'latest', sourceType: 'module' });
  let functionNode = null;
  walk(ast, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === functionName) functionNode = node;
  });
  if (!functionNode) throw new Error(`missing function ${functionName}`);
  let objectExpression = null;
  walk(functionNode.body, (node) => {
    if (node.type === 'VariableDeclarator' && node.id?.name === constantName) objectExpression = node.init;
  });
  if (objectExpression?.type !== 'ObjectExpression') {
    throw new Error(`missing object constant ${functionName}.${constantName}`);
  }
  return Object.fromEntries(
    objectExpression.properties.map((property) => {
      const key = property.key?.name ?? property.key?.value;
      if (typeof key !== 'string' || property.value?.type !== 'Literal' || typeof property.value.value !== 'string') {
        throw new Error(`${functionName}.${constantName} contains a non-literal entry`);
      }
      return [key, property.value.value];
    }),
  );
}

function fixedRow({ id, source, prefix, quote }) {
  return { id, source, prefix, quote, template_slots: [], fixed_segments: [quote] };
}

function templateRow({ id, source, prefix, fixedSegments, slots }) {
  if (fixedSegments.length !== slots.length + 1) throw new Error(`invalid template row ${id}`);
  const quote = fixedSegments
    .map((segment, index) => `${segment}${slots[index] ? `{{${slots[index]}}}` : ''}`)
    .join('');
  return { id, source, prefix, quote, template_slots: slots, fixed_segments: fixedSegments };
}

function keyedRows(map, { idPrefix, sourceConstant, prefix }) {
  return Object.keys(map)
    .sort()
    .map((key) =>
      fixedRow({
        id: `${idPrefix}.${key}`,
        source: `services/tutorStubFirstDraftContract.js#${sourceConstant}.${key}`,
        prefix: prefix(key),
        quote: map[key],
      }),
    );
}

const OUTCOME_A1_OUT_CLASSIFICATIONS = Object.freeze({
  'uptake.accelerated': {
    switching_variable: 'responseCompositionFrame.learner_dag.learner_advance.accelerated',
    trace:
      'Learner-DAG advancement is computed from learner state before response configuration; the gate verdict, repair policy, and register selection do not write it.',
  },
  'uptake.learner_move': {
    switching_variable: 'contract.learner_move from learnerText and responseCompositionFrame.learner_move',
    trace:
      'The learner-move surface is copied from the learner turn and composition frame; the gate decision path cannot change that learner-state field.',
  },
  'uptake.writable_complementary': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) with due release cues',
    trace:
      'The writable-entry classifier reads learner wording and due evidence before the gate-selected response configuration; the gate path cannot reach either switch.',
  },
  'uptake.writable_causal': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) with a named causal contract',
    trace:
      'The writable-entry request and causal contract are derived from learner wording and committed public evidence; the gate path cannot reach them.',
  },
  'uptake.writable_causal_generic': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) with an unnamed causal subject',
    trace:
      'The writable-entry request and causal contract are derived from learner wording and committed public evidence; the gate path cannot reach them.',
  },
  'uptake.writable_record': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) with a rendered public record',
    trace:
      'The writable-entry request and public-record availability are learner/evidence inputs; the gate path cannot reach them.',
  },
  'uptake.writable_record_fallback': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) without a rendered public record',
    trace:
      'The writable-entry request and public-record availability are learner/evidence inputs; the gate path cannot reach them.',
  },
  'uptake.responsive_repair': {
    switching_variable: 'questionSupport.responsiveRepairRequired',
    trace:
      'Question support is compiled from the learner turn upstream of response selection; the gate verdict, repair policy, and register selection do not write responsiveRepairRequired.',
  },
  'opening.instructional_meta': {
    switching_variable: 'responseCompositionFrame.discourse_plane.plane',
    trace:
      'The learner-wording discourse-plane classifier sets instructional_meta upstream of the gate, and instructional repair structurally overrides the gate-selected stance and action.',
  },
  'opening.writable_before_due_evidence': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) with due release cues',
    trace:
      'The writable-entry classifier reads learner wording and due evidence before the gate-selected response configuration; the gate path cannot reach either switch.',
  },
  'opening.writable_entry': {
    switching_variable: 'tutorStubLearnerRequestsWritableEntry(learnerText) without due release cues',
    trace:
      'The writable-entry classifier reads learner wording and due evidence before the gate-selected response configuration; the gate path cannot reach either switch.',
  },
  'part.prop.existing': {
    switching_variable: 'scene_action_budget.saturated and dramaticReleaseFrame.requiresExhibitHandoff',
    trace:
      'Prop availability is fixed by scene-budget and release state; the gate decision path does not write either field.',
  },
  'part.prop.named': {
    switching_variable: 'scene_action_budget.saturated and dramaticReleaseFrame.requiresExhibitHandoff',
    trace:
      'Prop availability is fixed by scene-budget and release state; the gate decision path does not write either field.',
  },
  'tactic.support.0': {
    switching_variable: 'configuration.support_level equal to zero or unset',
    trace:
      'The null branch returns an empty string, so there are no instruction bytes to inject regardless of reachability.',
  },
  'tactic.source_accessibility.max_words': {
    switching_variable: 'sourceAccessibility.effective_mode and sourceAccessibility.owner',
    trace:
      'Source-accessibility mode is compiled from the source policy and due-source contract, not from the gate verdict, repair policy, or register selection.',
  },
  'tactic.source_accessibility.material_tokens': {
    switching_variable: 'sourceAccessibility.effective_mode and sourceAccessibility.owner',
    trace:
      'Source-accessibility mode is compiled from the source policy and due-source contract, not from the gate verdict, repair policy, or register selection.',
  },
  'tactic.source_accessibility.constraints': {
    switching_variable: 'sourceAccessibility.effective_mode and sourceAccessibility.owner',
    trace:
      'Source-accessibility mode is compiled from the source policy and due-source contract, not from the gate verdict, repair policy, or register selection.',
  },
  'tactic.source_boundary': {
    switching_variable: 'contract.evidence.active',
    trace:
      'Active SOURCE presence is fixed by dramatic release state before the speaking configuration; the gate path cannot create or remove due evidence.',
  },
  'tactic.causal_performance': {
    switching_variable: 'writableEntryCausalContract from learner wording and committed public evidence',
    trace:
      'The causal-performance addition is switched by the writable-entry classifier and public evidence, neither of which the gate path can change.',
  },
  'handoff.settled': {
    switching_variable: 'conversational_completion.resolved and its prohibited settled surfaces',
    trace:
      'Settled-surface bookkeeping is copied from the learner-side conversational-completion frame; the gate path does not write it.',
  },
  'handoff.declarative_fallback': {
    switching_variable: 'absence of progression.handoff_contract.instruction under declarative question support',
    trace:
      'compileTutorStubTurnProgressionContract always supplies handoff_contract.instruction; the gate path cannot create the missing-instruction condition for this fallback literal.',
  },
  'handoff.bounded_choices': {
    switching_variable: 'questionSupport.modality matching bounded choice',
    trace:
      'The compact host plan appends this string directly from question-support modality, an upstream learner-state field the gate path cannot write.',
  },
  'handoff.clarification_invitation': {
    switching_variable: 'questionSupport.clarificationInvitationRequired',
    trace:
      'The compact host plan appends this string directly from an upstream question-support field the gate path cannot write.',
  },
  'action.override.responsive_repair': {
    switching_variable: 'questionSupport.responsiveRepairRequired',
    trace:
      'Responsive repair is fixed by question-support analysis upstream of the gate; the gate path cannot write the flag.',
  },
});

function inClassification(id) {
  if (id === 'uptake.default') {
    return {
      switching_variable: 'progression.public_obligation_contract.complete versus the compact-uptake fallback',
      trace:
        'The gate can supply public_obligation_directive; compilation turns it into a complete public-obligation contract that replaces or restores the default uptake branch.',
    };
  }
  if (id === 'opening.default_response') {
    return {
      switching_variable:
        'fallback after progression.public_obligation_contract.complete and upstream opening branches',
      trace:
        'The gate can supply public_obligation_directive, so its decision path reaches the public-obligation discriminator immediately above this fallback.',
    };
  }
  if (id.startsWith('part.')) {
    return {
      switching_variable: 'response_configuration.actorial_part and actorial_part_label',
      trace:
        'Gate-selected action family and stance feed selectTutorStubActorialPart; the resulting register selection chooses the compact part cue and wrapper.',
      ...(id === 'part.fallback'
        ? { doubt: 'Reachability of an unlisted part value is not proven; ruling 060b keeps uncertain traces IN.' }
        : {}),
    };
  }
  if (id.startsWith('tactic.execution.')) {
    return {
      switching_variable: 'response_configuration.actorial_performance.id',
      trace:
        'The gate-selected stance feeds selectTutorStubActorialPerformance, so register selection can change which tactic execution cue renders.',
    };
  }
  if (id.startsWith('tactic.support.')) {
    return {
      switching_variable: 'response_configuration.support_level',
      trace:
        'Support level is a policy-selected response-configuration field downstream of the gate; ruling 060b keeps the complete nonempty support cue family in.',
    };
  }
  if (id === 'tactic.delivered_boundary') {
    return {
      switching_variable: 'performance obligation tactic_applicability for the gate-selected actorial_performance',
      trace:
        'The gate-selected stance changes the requested tactic; the performance compiler may replace an inapplicable selected tactic and inject this transition.',
    };
  }
  if (id === 'tactic.direction_only_rapid_handoff') {
    return {
      switching_variable: 'questionSupport.answerability together with gate-reachable actorial_performance.id',
      trace:
        'Question-support state is fixed, but the gate-selected stance can choose or displace rapid_handoff, so the gate path can change whether this recast renders.',
    };
  }
  if (id.startsWith('tactic.question_boundary.')) {
    return {
      switching_variable: 'progression.handoff_contract.question_allowed',
      trace:
        'Gate-selected action family and public_obligation_directive feed chooseHandoffMode, which sets question_allowed and selects the handoff-owned versus no-question boundary.',
    };
  }
  if (id.startsWith('tactic.question_owned.')) {
    return {
      switching_variable: 'gate-reachable actorial_performance.id and progression.handoff_contract question ownership',
      trace:
        'The gate-selected stance changes the tactic, while gate-selected action/public-obligation state can change handoff ownership; either path can change the rendered recast.',
    };
  }
  if (id.startsWith('stance.')) {
    return {
      switching_variable: 'response_configuration.engagement_stance',
      trace:
        'An active warranted decision patches engagement_stance directly, so register selection can change the compact stance cue.',
      ...(id === 'stance.fallback'
        ? { doubt: 'Reachability of an unlisted stance value is not proven; ruling 060b keeps uncertain traces IN.' }
        : {}),
    };
  }
  if (id === 'handoff.bridge') {
    return {
      switching_variable: 'turn_focus_contract.sibling_relation_requires_explicit_bridge',
      trace:
        'A gate-supplied complete public obligation forces sibling_relation_requires_explicit_bridge false, so the gate path can suppress or restore this bridge.',
    };
  }
  if (id === 'handoff.public_limit' || id === 'handoff.optional_question') {
    return {
      switching_variable: 'progression.handoff_contract mode and question_required',
      trace:
        'Gate-selected action family, tactic, and public obligation feed chooseHandoffMode and question_required, so the gate path can change this handoff branch.',
    };
  }
  if (id === 'handoff.source_question') {
    return {
      switching_variable: 'development.action_family equal to stage_next_step with active evidence',
      trace:
        'Evidence presence is fixed, but the repair policy can select or displace stage_next_step and thereby change whether this string renders.',
    };
  }
  if (id === 'handoff.action_question') {
    return {
      switching_variable: 'gate-reachable compact_action_instruction and default handoff mode',
      trace:
        'The repair policy selects the action family embedded in this template, and gate-selected action/public-obligation state can also change the default handoff branch.',
    };
  }
  if (id === 'action.override.closure') {
    return {
      switching_variable: 'dialogueClosureFrame.mandatory after adaptive-warrant inquiry-completion constraint',
      trace:
        'The active gate constrains legacy closure with its inquiry-completion verdict, so its decision path can suppress or retain the closure override.',
    };
  }
  if (id === 'action.override.active_source') {
    return {
      switching_variable: 'development.action_family equal to stage_next_step with active evidence',
      trace:
        'Evidence presence is fixed, but the gate repair policy can select or displace stage_next_step and thereby change the override.',
    };
  }
  if (id.startsWith('action.compact_cue.')) {
    return {
      switching_variable: 'response_configuration.action_family',
      trace:
        'The active gate repair policy overrides action_family directly; ruling 060b requires the whole action cue family without reachability pruning.',
    };
  }
  throw new Error(`missing IN membership classification for ${id}`);
}

function classifyCandidate(row) {
  const excluded = OUTCOME_A1_OUT_CLASSIFICATIONS[row.id];
  const classification = excluded || inClassification(row.id);
  return {
    id: row.id,
    source: row.source,
    switching_variable: classification.switching_variable,
    gate_decision_path_reachable: row.id === 'tactic.support.0' ? true : !excluded,
    verdict: excluded ? 'OUT' : 'IN',
    trace: classification.trace,
    ...(classification.doubt ? { doubt: classification.doubt } : {}),
  };
}

function sourceRows() {
  const firstDraftPath = 'services/tutorStubFirstDraftContract.js';
  const firstDraft = read(firstDraftPath).toString('utf8');
  const partCues = objectLiteralMap(firstDraft, 'COMPACT_PART_CUES');
  const tacticCues = objectLiteralMap(firstDraft, 'TACTIC_EXECUTION_CUES');
  const stanceCues = functionObjectLiteralMap(firstDraft, 'compactStanceInstruction', 'cues');
  const actionCues = functionObjectLiteralMap(firstDraft, 'compactActionInstruction', 'cues');
  const rows = [
    fixedRow({
      id: 'uptake.default',
      source: `${firstDraftPath}#compactUptakeInstruction.default`,
      prefix: 'When no narrower uptake branch applies, the compact uptake string is:',
      quote: 'Answer, credit, qualify, correct, or receive the learner’s concrete move; never use generic praise.',
    }),
    fixedRow({
      id: 'uptake.accelerated',
      source: `${firstDraftPath}#compactUptakeInstruction.accelerated`,
      prefix: 'When the public contract records learner acceleration, the compact uptake addition is:',
      quote: 'Credit every warranted move; do not ask for it again.',
    }),
    templateRow({
      id: 'uptake.learner_move',
      source: `${firstDraftPath}#compactUptakeInstruction.learnerMove`,
      prefix:
        'When the public contract carries a learner move, this compact uptake template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['Carry forward this move: ', ''],
      slots: ['learner_move'],
    }),
    fixedRow({
      id: 'uptake.writable_complementary',
      source: `${firstDraftPath}#compactUptakeInstruction.writable.complementary`,
      prefix: 'When a writable entry must precede complementary due evidence, the compact uptake string is:',
      quote: 'Begin exactly “Write:” with one learner-sayable pre-turn limit; do not preview or paraphrase SOURCE.',
    }),
    templateRow({
      id: 'uptake.writable_causal',
      source: `${firstDraftPath}#compactUptakeInstruction.writable.causal`,
      prefix:
        'When the public contract carries a causal subject and outcome, this compact uptake template is rendered and the gate fills its named slots from the public contract:',
      fixedSegments: [
        'Begin exactly “Write:” with this learner-sayable sentence: “The ',
        ' did not cause the ',
        '.” Keep both named roles exact; never widen either role or change cause into prevention.',
      ],
      slots: ['causal_subject', 'causal_outcome'],
    }),
    fixedRow({
      id: 'uptake.writable_causal_generic',
      source: `${firstDraftPath}#compactUptakeInstruction.writable.causal_generic`,
      prefix:
        'When the public contract carries a causal relation without a named subject, the compact uptake string is:',
      quote:
        'Begin exactly “Write:” with one learner-sayable sentence: the candidate was inactive while the outcome still occurred, so this rules out candidate causation. Preserve named actors and polarity; never say the candidate failed to prevent or stop the outcome.',
    }),
    fixedRow({
      id: 'uptake.writable_record',
      source: `${firstDraftPath}#compactUptakeInstruction.writable.record`,
      prefix: 'When a writable entry can point to a rendered public record, the compact uptake string is:',
      quote:
        'Begin exactly “Write:” with one learner-sayable sentence saying what one numbered RECORD line says. Preserve its actors, relation, and polarity; never reverse cause or evidentiary force, and claim nothing the line does not carry.',
    }),
    fixedRow({
      id: 'uptake.writable_record_fallback',
      source: `${firstDraftPath}#compactUptakeInstruction.writable.record_fallback`,
      prefix: 'When a writable entry has no rendered public-record block, the compact uptake fallback is:',
      quote:
        'Begin exactly “Write:” with one learner-sayable sentence licensed by the public record. Preserve actors, relation, and polarity; never reverse cause or evidentiary force.',
    }),
    fixedRow({
      id: 'uptake.responsive_repair',
      source: `${firstDraftPath}#compactUptakeInstruction.responsive_repair`,
      prefix: 'When the public contract requires responsive repair, the compact uptake string is:',
      quote: 'Answer the learner’s unanswered question directly before doing anything else.',
    }),
    fixedRow({
      id: 'opening.instructional_meta',
      source: `${firstDraftPath}#buildTutorStubFirstDraftContract.opening.instructional_meta`,
      prefix: 'When the public contract selects instructional-meta repair, its rendered opening instruction is:',
      quote:
        'Begin by directly acknowledging that the learner wants the explanation made easier to follow. Restate the latest tutor point in ordinary words. Do not quote the whole learner request, treat it as evidence, or advance the inquiry.',
    }),
    fixedRow({
      id: 'opening.writable_before_due_evidence',
      source: `${firstDraftPath}#buildTutorStubFirstDraftContract.opening.writable_before_due_evidence`,
      prefix: 'When a writable entry precedes due evidence, its rendered opening instruction is:',
      quote:
        'The learner asked what to write while new evidence is due in this reply. Begin exactly with “Write:” and supply one complete learner-sayable sentence about the pre-turn public status or evidentiary limit. It must complement the new evidence: do not state, paraphrase, preview, or summarize any PUBLIC EVIDENCE DUE NOW. Only then enact each due clue once in the development beat.',
    }),
    fixedRow({
      id: 'opening.writable_entry',
      source: `${firstDraftPath}#buildTutorStubFirstDraftContract.opening.writable_entry`,
      prefix: 'When a writable entry is requested without due evidence, its rendered opening instruction is:',
      quote:
        'The learner asked what to write. Begin exactly with “Write:” and supply one complete learner-sayable sentence licensed by the current public evidence. This direct entry is the learner uptake; only then perform the selected development beat. Do not substitute a prop action or another question for the requested sentence.',
    }),
    fixedRow({
      id: 'opening.default_response',
      source: `${firstDraftPath}#buildTutorStubFirstDraftContract.opening.default`,
      prefix: 'When no narrower opening branch applies, the rendered opening instruction is:',
      quote:
        'Respond to the learner’s actual contribution in the first sentence by answering, crediting, qualifying, correcting, or receiving it. Paraphrase its concrete claim or concern rather than echoing the learner’s substantive wording; do not begin with generic praise.',
    }),
    ...keyedRows(partCues, {
      idPrefix: 'part.compact_cue',
      sourceConstant: 'COMPACT_PART_CUES',
      prefix: (key) =>
        `When the downstream selector carries the ${key.replaceAll('_', ' ')} part, its compact part cue is:`,
    }),
    fixedRow({
      id: 'part.inline.scene_partner',
      source: `${firstDraftPath}#compactPartInstruction.scene_partner`,
      prefix: 'When the selected part is scene partner, the live inline compact cue is:',
      quote:
        'place both speakers at one named public object using “you”, “we”, or “together”; a solitary “I” beside the object does not count; do not ask a question yet',
    }),
    fixedRow({
      id: 'part.fallback',
      source: `${firstDraftPath}#compactPartInstruction.fallback`,
      prefix: 'When no named compact part cue is available, the compact part fallback is:',
      quote: 'perform one concrete public action or judgment',
    }),
    fixedRow({
      id: 'part.prop.existing',
      source: `${firstDraftPath}#compactPartInstruction.prop.existing`,
      prefix: 'When the public contract forbids a new prop, the compact part addition is:',
      quote: 'Use an already-named object; add no prop.',
    }),
    fixedRow({
      id: 'part.prop.named',
      source: `${firstDraftPath}#compactPartInstruction.prop.named`,
      prefix: 'When the public contract permits a scene object, the compact part addition is:',
      quote: 'Name one public scene object.',
    }),
    templateRow({
      id: 'part.wrapper',
      source: `${firstDraftPath}#compactPartInstruction.wrapper`,
      prefix:
        'For every selected part, this compact wrapper is rendered and the gate fills its named slots from the public contract:',
      fixedSegments: ['As ', ', without naming the role, ', '.'],
      slots: ['actorial_part_label', 'compact_part_cue'],
    }),
    ...keyedRows(tacticCues, {
      idPrefix: 'tactic.execution',
      sourceConstant: 'TACTIC_EXECUTION_CUES',
      prefix: (key) =>
        `When the compact tactic builder carries the ${key.replaceAll('_', ' ')} tactic, its execution cue is:`,
    }),
    fixedRow({
      id: 'tactic.support.3',
      source: `${firstDraftPath}#compactSupportInstruction.level_3`,
      prefix: 'When support level is three, the compact tactic support string is:',
      quote: 'Make the public connection explicit.',
    }),
    fixedRow({
      id: 'tactic.support.2',
      source: `${firstDraftPath}#compactSupportInstruction.level_2`,
      prefix: 'When support level is two, the compact tactic support string is:',
      quote: 'Give one concrete hint, leaving the judgment open.',
    }),
    fixedRow({
      id: 'tactic.support.1',
      source: `${firstDraftPath}#compactSupportInstruction.level_1`,
      prefix: 'When support level is one, the compact tactic support string is:',
      quote: 'Give only a light directional cue.',
    }),
    fixedRow({
      id: 'tactic.support.0',
      source: `${firstDraftPath}#compactSupportInstruction.level_0`,
      prefix: 'When support level is zero or unset, the compact tactic support string is empty:',
      quote: '',
    }),
    templateRow({
      id: 'tactic.source_accessibility.max_words',
      source: `${firstDraftPath}#compactSourceAccessibilityInstruction.max_words`,
      prefix:
        'When source accessibility compensation is active, this compact template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['Immediately after SOURCE, write one unquoted statement of at most ', ' words.'],
      slots: ['max_words'],
    }),
    templateRow({
      id: 'tactic.source_accessibility.material_tokens',
      source: `${firstDraftPath}#compactSourceAccessibilityInstruction.material_tokens`,
      prefix:
        'When source accessibility compensation is active, this compact template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['Reuse at least ', ' material SOURCE words in order and one source-specific anchor.'],
      slots: ['min_material_source_tokens'],
    }),
    fixedRow({
      id: 'tactic.source_accessibility.constraints',
      source: `${firstDraftPath}#compactSourceAccessibilityInstruction.constraints`,
      prefix: 'When source accessibility compensation is active, its compact constraint string is:',
      quote: 'Add only a, an, or the; preserve no, not, only, and may; do not copy all SOURCE or ask.',
    }),
    fixedRow({
      id: 'tactic.source_boundary',
      source: `${firstDraftPath}#compactTacticInstruction.sourceBoundary`,
      prefix: 'When public source evidence is active, the compact tactic prefix is:',
      quote: 'After SOURCE closes, make TACTIC a new unquoted sentence.',
    }),
    fixedRow({
      id: 'tactic.delivered_boundary',
      source: `${firstDraftPath}#compactTacticInstruction.transition`,
      prefix: 'When the requested pressure tactic is inapplicable, the compact tactic transition is:',
      quote: 'Use the delivered boundary tactic, not the requested pressure tactic.',
    }),
    fixedRow({
      id: 'tactic.direction_only_rapid_handoff',
      source: `${firstDraftPath}#buildTutorStubFirstDraftContract.directionOnlyWithoutNewEvidence`,
      prefix: 'When direction-only support recasts rapid handoff, the compact tactic execution string is:',
      quote:
        'Move straight from one already-public object or line to the present evidentiary limit. State the direction of the missing support yourself and end declaratively; do not ask the learner to name unseen evidence.',
    }),
    templateRow({
      id: 'tactic.causal_performance',
      source: `${firstDraftPath}#typedCausalPerformanceInstruction`,
      prefix:
        'When the public contract carries a causal subject and outcome, this tactic template is rendered and the gate fills its named slots from the public contract:',
      fixedSegments: [
        'Say “The ',
        ' did not cause the ',
        '; actual cause remains open.” Add no third clause or role change.',
      ],
      slots: ['causal_subject', 'causal_outcome'],
    }),
    fixedRow({
      id: 'tactic.question_boundary.handoff',
      source: `${firstDraftPath}#questionOwnedTacticExecution.boundary.handoff`,
      prefix: 'When the handoff owns an allowed question, the compact tactic boundary is:',
      quote: 'Ask no question here; HANDOFF owns it.',
    }),
    fixedRow({
      id: 'tactic.question_boundary.none',
      source: `${firstDraftPath}#questionOwnedTacticExecution.boundary.none`,
      prefix: 'When the public contract forbids a question, the compact tactic boundary is:',
      quote: 'Ask no question here.',
    }),
    templateRow({
      id: 'tactic.question_owned.rapid_handoff',
      source: `${firstDraftPath}#questionOwnedTacticExecution.rapid_handoff`,
      prefix:
        'When rapid handoff delegates question ownership, this compact tactic template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['Move straight from the named public object or line to one short declarative observation. ', ''],
      slots: ['question_boundary'],
    }),
    templateRow({
      id: 'tactic.question_owned.shared_scene_invitation',
      source: `${firstDraftPath}#questionOwnedTacticExecution.shared_scene_invitation`,
      prefix:
        'When shared-scene invitation delegates question ownership, this compact tactic template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: [
        'Invite shared attention to the named public object declaratively using “you”, “we”, or “together”. ',
        '',
      ],
      slots: ['question_boundary'],
    }),
    templateRow({
      id: 'tactic.question_owned.general',
      source: `${firstDraftPath}#questionOwnedTacticExecution.general`,
      prefix:
        'When another tactic delegates question ownership, this compact tactic template is rendered and the gate fills its named slots from the public contract:',
      fixedSegments: ['', ' ', ''],
      slots: ['tactic_execution', 'question_boundary'],
    }),
    ...keyedRows(stanceCues, {
      idPrefix: 'stance.compact_cue',
      sourceConstant: 'compactStanceInstruction.cues',
      prefix: (key) => `When the gate carries the ${key.replaceAll('_', ' ')} stance, its compact stance cue is:`,
    }),
    templateRow({
      id: 'stance.fallback',
      source: `${firstDraftPath}#compactStanceInstruction.fallback`,
      prefix:
        'When the public contract carries an unlisted stance, this compact stance fallback is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['Make it visibly ', '.'],
      slots: ['engagement_stance'],
    }),
    fixedRow({
      id: 'handoff.settled',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.settled`,
      prefix: 'When the public contract names a settled surface, the compact handoff addition is:',
      quote: 'Do not reopen the settled point.',
    }),
    fixedRow({
      id: 'handoff.bridge',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.bridge`,
      prefix: 'When the public contract requires a sibling-relation bridge, the compact handoff addition is:',
      quote: 'Connect SOURCE to the learner’s requested relation.',
    }),
    fixedRow({
      id: 'handoff.declarative_fallback',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.declarative_fallback`,
      prefix: 'When declarative support has no supplied handoff instruction, the compact handoff fallback is:',
      quote: 'End declaratively; ask no question.',
    }),
    fixedRow({
      id: 'handoff.public_limit',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.public_limit`,
      prefix: 'When questions are forbidden without another special branch, the compact handoff string is:',
      quote: 'State the current public limit through the selected action; ask no question.',
    }),
    fixedRow({
      id: 'handoff.optional_question',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.optional_question`,
      prefix: 'When a handoff question is optional, the compact handoff string is:',
      quote:
        'Carry the selected action to TURN FOCUS. HANDOFF may ask one final question there; otherwise end declaratively.',
    }),
    fixedRow({
      id: 'handoff.source_question',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.source_question`,
      prefix:
        'When active source evidence and stage-next-step require a handoff question, the compact handoff string is:',
      quote: 'Ask one HANDOFF question about what SOURCE changes, supports, or rules out.',
    }),
    templateRow({
      id: 'handoff.action_question',
      source: `${firstDraftPath}#compactProgressionHandoffInstruction.action_question`,
      prefix:
        'When the default handoff owns the final question, this compact handoff template is rendered and the gate fills its named slot from the public contract:',
      fixedSegments: ['', ' HANDOFF owns the one final question.'],
      slots: ['compact_action_instruction'],
    }),
    fixedRow({
      id: 'handoff.bounded_choices',
      source: `${firstDraftPath}#buildHostPlan.bounded_choice`,
      prefix: 'When question-support state requires bounded choices, the compact handoff addition is:',
      quote:
        'Express two or three recognizable public-safe choices declaratively; do not turn the list into a question.',
    }),
    fixedRow({
      id: 'handoff.clarification_invitation',
      source: `${firstDraftPath}#buildHostPlan.clarification_invitation`,
      prefix: 'When question-support state requires a clarification invitation, the compact handoff addition is:',
      quote: 'Also say that the learner may ask for a direct explanation of one clue, connection, or term.',
    }),
    fixedRow({
      id: 'action.override.closure',
      source: `${firstDraftPath}#compactActionInstruction.closure`,
      prefix: 'When the public contract requires closure, the compact action override is:',
      quote: 'State the licensed public finding and close the inquiry; ask no question.',
    }),
    fixedRow({
      id: 'action.override.responsive_repair',
      source: `${firstDraftPath}#compactActionInstruction.responsive_repair`,
      prefix: 'When the public contract requires responsive repair, the compact action override is:',
      quote: 'End after the direct answer or one public way to check it; do not substitute another exercise.',
    }),
    fixedRow({
      id: 'action.override.active_source',
      source: `${firstDraftPath}#compactActionInstruction.active_source`,
      prefix: 'When active source evidence carries stage-next-step, the compact action override is:',
      quote: 'Return SOURCE as one concrete question about what it changes, supports, or rules out.',
    }),
    ...keyedRows(actionCues, {
      idPrefix: 'action.compact_cue',
      sourceConstant: 'compactActionInstruction.cues',
      prefix: (key) =>
        `When the gate carries the ${key.replaceAll('_', ' ')} action family, its compact action cue is:`,
    }),
  ];
  return rows;
}

function classifiedSourceRows() {
  return sourceRows().map((row) => ({ row, classification: classifyCandidate(row) }));
}

function includedSourceRows() {
  return classifiedSourceRows()
    .filter(({ classification }) => classification.verdict === 'IN')
    .map(({ row }) => row);
}

function enumerationRule() {
  return {
    ...OUTCOME_A1_ENUMERATION_RULE,
    per_string_classification: classifiedSourceRows().map(({ classification }) => classification),
  };
}

function renderMenu(rows) {
  return rows.map((row) => `${row.prefix}\n<verbatim>\n${row.quote}\n</verbatim>`).join('\n\n');
}

function replaceDeep(value, replacements) {
  if (Array.isArray(value)) return value.map((entry) => replaceDeep(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceDeep(entry, replacements)]));
  }
  if (typeof value !== 'string') return value;
  return replacements.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

export function buildOutcomePilotWorlds() {
  const sources = [
    {
      source: 'config/drama-derivation/world-022-foxtrot-jukebox.yaml',
      replacements: [
        ['world_022_foxtrot_jukebox', 'world_101_kestrel_signal_lamp'],
        ['The Case of the Silent Jukebox', 'The Case of the Blind Signal Lamp'],
        ['Waystation Foxtrot', 'Waystation Kestrel'],
        ['Foxtrot', 'Kestrel'],
        ['foxtrot', 'kestrel'],
        ['jukebox', 'signal lamp'],
        ['Jukebox', 'Signal lamp'],
        ['karaoke', 'signal drill'],
        ['Karaoke', 'Signal drill'],
        ['music core', 'message core'],
        ['Moth', 'Kite'],
        ['moth', 'kite'],
        ['Hessa', 'Runa'],
        ['hessa', 'runa'],
        ['cadet', 'apprentice'],
        ['messHall', 'signalRoom'],
        ['mess hall', 'signal room'],
        ['wipePulse', 'faultPulse'],
      ],
    },
    {
      source: 'config/drama-derivation/world-028-larkspur-fridge.yaml',
      replacements: [
        ['world_028_larkspur_fridge', 'world_102_marigold_archive_box'],
        ['The Lunchbox on Shelf Two', 'The Archive Box in Bay Three'],
        ['Larkspur Studio', 'Marigold Archive'],
        ['Larkspur', 'Marigold'],
        ['larkspur', 'marigold'],
        ['lunchbox', 'archive box'],
        ['Lunchbox', 'Archive box'],
        ['fridge', 'records cupboard'],
        ['Fridge', 'Records cupboard'],
        ['shelf two', 'bay three'],
        ['Priya', 'Nadia'],
        ['priya', 'nadia'],
        ['Dario', 'Felix'],
        ['dario', 'felix'],
        ['Wrenfold', 'Osprey'],
        ['wrenfold', 'osprey'],
        ['coordinator', 'archivist'],
        ['incidentLog', 'accessLedger'],
        ['incident log', 'access ledger'],
        ['noonWindow', 'closingWindow'],
        ['noon window', 'closing window'],
        ['kitchen', 'records room'],
      ],
    },
  ];
  return sources.map(({ source, replacements }) => {
    const sourceBytes = read(source);
    const world = replaceDeep(yaml.parse(sourceBytes.toString('utf8')), replacements);
    world.presentation = {
      ...world.presentation,
      outcome_study_fresh_derivation: true,
      source_family_world: yaml.parse(sourceBytes.toString('utf8')).id,
    };
    return { source, source_sha256: sha256(sourceBytes), id: world.id, world };
  });
}

export function writeOutcomePilotWorlds(outputDirectory) {
  const resolvedDirectory = path.resolve(ROOT, outputDirectory);
  fs.mkdirSync(resolvedDirectory, { recursive: true });
  return buildOutcomePilotWorlds().map((entry) => {
    const output = path.join(resolvedDirectory, `${entry.id}.yaml`);
    fs.writeFileSync(output, yaml.stringify(entry.world, { lineWidth: 100 }));
    return { ...entry, output, output_sha256: sha256(fs.readFileSync(output)) };
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// Which registered burned corpora are no longer on this machine. Empty is the
// normal state and the only state in which a first launch can run at all; a
// non-empty list means every fresh-launch guard here refuses by design, and
// only a restart carrying the launch record can proceed (defect ledger 21).
export function absentOutcomeExcludedArtifacts() {
  return OUTCOME_PILOT_EXCLUDED_ARTIFACTS.filter(
    (artifactPath) => !fs.existsSync(path.isAbsolute(artifactPath) ? artifactPath : path.join(ROOT, artifactPath)),
  );
}

// One artifact's contribution to the exclusion set, decided from bytes rather
// than from a path, so the three cases below can be exercised on any machine
// and not only on one where a file happens to be gone.
//
//   bytes present, no record          — read it, as every launch always has
//   bytes present, record disagrees   — refuse: substitution is for absence,
//                                       never for a change
//   bytes absent, record present      — stand in from the record (restart only)
//   bytes absent, no record           — refuse, as a first launch always has
export function outcomeExclusionRow({ artifactPath, bytes = null, recorded = null, worldIds = [] } = {}) {
  if (bytes === null || bytes === undefined) {
    if (!recorded) throw new Error(`required excluded artifact is missing: ${artifactPath}`);
    return {
      path: artifactPath,
      sha256: recorded.sha256,
      embedded_fingerprint_count: recorded.embedded_fingerprint_count ?? 0,
      // The launch record keeps each artifact's digest and the count of the
      // fingerprints inside it, never the fingerprints themselves. A row taken
      // from the record therefore contributes a smaller exclusion set than the
      // file did, which is safe only under the candidate-identity check the
      // guard applies whenever any row arrives this way.
      embedded_fingerprints: [],
      candidate_world_ids_present: recorded.candidate_world_ids_present ?? [],
      source: 'checkpoint_record',
    };
  }
  const digest = sha256(bytes);
  if (recorded && recorded.sha256 !== digest) {
    throw new Error(
      `excluded artifact bytes changed since launch: ${artifactPath} (recorded ${recorded.sha256}, found ${digest})`,
    );
  }
  const text = bytes.toString('utf8');
  const embeddedFingerprints = [...new Set(text.match(/[a-f0-9]{64}/gu) || [])];
  return {
    path: artifactPath,
    sha256: digest,
    embedded_fingerprint_count: embeddedFingerprints.length,
    embedded_fingerprints: embeddedFingerprints,
    candidate_world_ids_present: worldIds.filter((worldId) => text.includes(worldId)),
    source: 'file',
  };
}

export function guardOutcomePilotPreparation({
  worldPaths,
  shape = OUTCOME_DEFAULT_RUN_SHAPE,
  seeds = shape.seeds,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  // A restart hands over the record this same guard wrote at launch. It is used
  // only for artifacts that no longer exist on disk (defect ledger 21: most of
  // the burned corpora live in the system temp directory, and a housekeeping
  // job with no relation to this study deletes them after about four days). A
  // first launch never passes this, so it still refuses on any missing file.
  recordedGuard = null,
} = {}) {
  if (!OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.includes(learnerProfile)) {
    throw new Error(`unsupported outcome-study learner profile: ${learnerProfile}`);
  }
  const worlds = (worldPaths || []).map((relativePath) => {
    const bytes = read(relativePath);
    const parsed = yaml.parse(bytes.toString('utf8'));
    return { path: relativePath, id: parsed.id, sha256: sha256(bytes) };
  });
  const conditions = ['bare', 'gated', 'standing_permission'];
  const candidates = worlds.flatMap((world) =>
    seeds.flatMap((seed) =>
      conditions.map((condition) => ({
        world: world.id,
        world_sha256: world.sha256,
        seed,
        condition,
        learner_profile: learnerProfile,
        horizon: 8,
      })),
    ),
  );
  const candidateFingerprints = candidates.map((row) =>
    sha256(
      canonicalJson({
        schema: 'machinespirits.adaptation-refinement.outcome-prepared-run-fingerprint.v1',
        ...row,
      }),
    ),
  );
  const recordedExclusions = new Map(
    (Array.isArray(recordedGuard?.excluded_artifacts) ? recordedGuard.excluded_artifacts : [])
      .filter((row) => typeof row?.path === 'string' && typeof row?.sha256 === 'string')
      .map((row) => [row.path, row]),
  );
  const artifactsFromRecord = [];
  const exclusions = OUTCOME_PILOT_EXCLUDED_ARTIFACTS.map((artifactPath) => {
    const resolved = path.isAbsolute(artifactPath) ? artifactPath : path.join(ROOT, artifactPath);
    const row = outcomeExclusionRow({
      artifactPath,
      bytes: fs.existsSync(resolved) ? fs.readFileSync(resolved) : null,
      recorded: recordedExclusions.get(artifactPath) || null,
      worldIds: worlds.map((world) => world.id),
    });
    if (row.source === 'checkpoint_record') artifactsFromRecord.push(artifactPath);
    return row;
  });
  const exclusionFingerprints = new Set(
    exclusions
      .flatMap((row) => [row.sha256, ...row.embedded_fingerprints])
      .concat(
        OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES.map((identity) =>
          sha256(
            canonicalJson({
              schema: 'machinespirits.adaptation-refinement.archived-deference-session-identity.v1',
              identity,
            }),
          ),
        ),
      ),
  );
  const duplicates = candidateFingerprints.filter(
    (fingerprint, index) => candidateFingerprints.indexOf(fingerprint) !== index,
  );
  const overlaps = candidateFingerprints.filter((fingerprint) => exclusionFingerprints.has(fingerprint));
  const worldIdOverlaps = exclusions.flatMap((row) => row.candidate_world_ids_present);
  // When any row came from the record, the exclusion set is short by the
  // fingerprints those files held, so this guard no longer proves the
  // candidates are clean on its own evidence. It proves something narrower and
  // sufficient: that these candidates are the very ones the launch already
  // tested against the complete set, and that the launch passed. A single
  // differing identity, seed, shape or persona refuses the transfer.
  const carriedFromRecord = artifactsFromRecord.length > 0;
  const recordedCandidates = Array.isArray(recordedGuard?.candidate_fingerprints)
    ? recordedGuard.candidate_fingerprints
    : [];
  const recordedIdentityMatch =
    recordedGuard?.status === 'passed' &&
    recordedGuard?.run_shape === shape.name &&
    recordedGuard?.learner_profile === learnerProfile &&
    canonicalJson(recordedGuard?.seeds) === canonicalJson([...seeds]) &&
    recordedCandidates.length === candidateFingerprints.length &&
    recordedCandidates.every((value, index) => value === candidateFingerprints[index]);
  // The size comes from the shape, not from a number written here twice. A
  // caller that hands over its own seed list must still hand over the count the
  // shape states, so a short or long list fails rather than quietly shrinking
  // the run.
  const pass =
    worlds.length === OUTCOME_WORLDS_PER_SEED &&
    seeds.length === shape.seeds.length &&
    candidates.length === shape.dialogues &&
    duplicates.length === 0 &&
    overlaps.length === 0 &&
    worldIdOverlaps.length === 0 &&
    (!carriedFromRecord || recordedIdentityMatch);
  return {
    schema: 'machinespirits.adaptation-refinement.outcome-preparation-fingerprint-guard.v1',
    zero_model_calls: true,
    status: pass ? 'passed' : 'failed',
    run_shape: shape.name,
    expected_prepared_run_count: shape.dialogues,
    comparison_scope:
      'Pre-call prepared-run identities are compared with artifact digests and every embedded SHA-256 fingerprint in the burned corpora, the frozen seed-514 matrix, and the three registered archived-session identities. After generation, the same-source annotationCaseFingerprint guard remains mandatory before either reader channel.',
    worlds,
    seeds: [...seeds],
    conditions,
    learner_profile: learnerProfile,
    prepared_run_count: candidates.length,
    candidate_fingerprints: candidateFingerprints,
    excluded_artifacts: exclusions.map(({ embedded_fingerprints: _omitted, ...row }) => row),
    deference_session_identities: [...OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES],
    exclusion_fingerprint_count: exclusionFingerprints.size,
    exclusion_source: carriedFromRecord ? 'files_and_checkpoint_record' : 'files',
    artifacts_from_checkpoint_record: [...artifactsFromRecord],
    recorded_candidate_identity_match: carriedFromRecord ? recordedIdentityMatch : null,
    recorded_exclusion_fingerprint_count: carriedFromRecord
      ? (recordedGuard?.exclusion_fingerprint_count ?? null)
      : null,
    duplicate_candidate_fingerprints: [...new Set(duplicates)],
    overlapping_fingerprints: [...new Set(overlaps)],
    overlapping_world_ids: [...new Set(worldIdOverlaps)],
    post_generation_case_guard_required: true,
  };
}

export function buildOutcomeStandingPermissionMenu() {
  const rows = includedSourceRows();
  return {
    schema: OUTCOME_A1_MENU_SCHEMA,
    source_sha256: { ...OUTCOME_A1_SOURCE_PINS },
    enumeration_rule: enumerationRule(),
    prefix_set: rows.map(({ id, prefix }) => ({ id, prefix })),
    entries: rows,
    menu_text: renderMenu(rows),
  };
}

export function guardOutcomeStandingPermissionMenu(material) {
  // CLAUDE.md (2026-08-21): every pinned path here is a source file in this repo
  // or a config YAML, so each digest is recorded and no longer decides the
  // guard verdict. Editing one of those files used to fail the menu guard, and
  // that is what happened to services/tutorStubFirstDraftContract.js.
  const sourceChecks = Object.fromEntries(
    Object.entries(OUTCOME_A1_SOURCE_PINS).map(([relativePath, expected]) => {
      const observed = sha256(read(relativePath));
      recordObservedDigest({
        label: `outcome-study menu source pin ${relativePath}`,
        filePath: relativePath,
        recordedSha256: expected,
        observedSha256: observed,
      });
      return [relativePath, { expected, observed, pass: observed === expected }];
    }),
  );
  const expectedRows = includedSourceRows();
  const expectedEnumerationRule = enumerationRule();
  const actualRows = Array.isArray(material?.entries) ? material.entries : [];
  const expectedById = new Map(expectedRows.map((row) => [row.id, row]));
  const actualById = new Map(actualRows.map((row) => [row.id, row]));
  const duplicateIds = actualRows.map((row) => row.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  const missing = expectedRows.filter((row) => !actualById.has(row.id)).map((row) => row.id);
  const unexpected = actualRows.filter((row) => !expectedById.has(row.id)).map((row) => row.id);
  const rowChecks = expectedRows.map((expected) => {
    const actual = actualById.get(expected.id);
    return {
      id: expected.id,
      quote_bytes_match: actual?.quote === expected.quote,
      fixed_segments_bytes_match: JSON.stringify(actual?.fixed_segments) === JSON.stringify(expected.fixed_segments),
      template_slots_match: JSON.stringify(actual?.template_slots) === JSON.stringify(expected.template_slots),
      prefix_bytes_match: actual?.prefix === expected.prefix,
      source_location_match: actual?.source === expected.source,
    };
  });
  const renderedMatches = material?.menu_text === renderMenu(actualRows);
  const enumerationRuleMatches = JSON.stringify(material?.enumeration_rule) === JSON.stringify(expectedEnumerationRule);
  const pass =
    material?.schema === OUTCOME_A1_MENU_SCHEMA &&
    duplicateIds.length === 0 &&
    missing.length === 0 &&
    unexpected.length === 0 &&
    rowChecks.every(
      (row) =>
        row.quote_bytes_match &&
        row.fixed_segments_bytes_match &&
        row.template_slots_match &&
        row.prefix_bytes_match &&
        row.source_location_match,
    ) &&
    enumerationRuleMatches &&
    renderedMatches;
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-menu-drift-guard.v1',
    zero_model_calls: true,
    status: pass ? 'passed' : 'failed',
    source_checks: sourceChecks,
    expected_entry_count: expectedRows.length,
    observed_entry_count: actualRows.length,
    missing,
    unexpected,
    duplicate_ids: [...new Set(duplicateIds)].sort(),
    enumeration_rule_matches: enumerationRuleMatches,
    rendered_menu_matches_entries: renderedMatches,
    rows: rowChecks,
  };
}

function main() {
  const [flag, outputPath] = process.argv.slice(2);
  if (!outputPath || !['--write-menu', '--write-worlds'].includes(flag)) {
    throw new Error(
      'Usage: node scripts/prepare-adaptive-warrant-outcome-study.js --write-menu <path> | --write-worlds <dir>',
    );
  }
  if (flag === '--write-worlds') {
    const worlds = writeOutcomePilotWorlds(outputPath);
    process.stdout.write(`${JSON.stringify({ worlds }, null, 2)}\n`);
    return;
  }
  const material = buildOutcomeStandingPermissionMenu();
  const guard = guardOutcomeStandingPermissionMenu(material);
  if (guard.status !== 'passed') throw new Error('standing-permission menu drift guard failed');
  const resolved = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(material, null, 2)}\n`);
  const textPath = resolved.replace(/\.json$/u, '.txt');
  fs.writeFileSync(textPath, `${material.menu_text}\n`);
  process.stdout.write(
    `${JSON.stringify({ output: resolved, text_output: textPath, entries: material.entries.length, guard }, null, 2)}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[outcome-study-a1] ${error.message}`);
    process.exitCode = 1;
  }
}
