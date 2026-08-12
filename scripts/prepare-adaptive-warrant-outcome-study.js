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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTCOME_A1_MENU_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-standing-permission-menu.v1';

export const OUTCOME_A1_SOURCE_PINS = Object.freeze({
  'services/tutorStubWarrantGate.js': 'db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24',
  'services/adaptiveWarrantPolicy.js': '9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d',
  'services/tutorStubFirstDraftContract.js': '868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29',
  'services/tutorStubQuestionSupport.js': '6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3',
  'config/engagement-registers.yaml': '6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2',
});

export const OUTCOME_A1_ENUMERATION_RULE = Object.freeze({
  rendered_layer:
    'Enumerate the fixed compact strings rendered by tutorStubFirstDraftContractPrompt downstream of a gate decision from the SHA-pinned services/tutorStubFirstDraftContract.js: every compact uptake branch; every COMPACT_PART_CUES value plus the inline scene-partner branch and other compact-part literals; every TACTIC_EXECUTION_CUES value plus compact tactic/support branches; every compact stance cue; every compact handoff branch; and every compact action cue. Sweep every stance and action-family key mechanically without reachability pruning.',
  templates:
    'For a compact template, quote every fixed segment byte-for-byte in source order and show each interpolated public-contract value as a named {{slot}}; the descriptive prefix states that the gate fills those slots from the public contract, and the drift guard compares the fixed_segments array byte-for-byte.',
  question_support:
    'Do not include buildTutorStubQuestionSupport tutorInstruction strings: they populate the detailed contract ending.instruction field, but the live compact host-plan renderer does not read that field. Include the compact handoff strings selected from question-support state flags instead.',
});

export const OUTCOME_PILOT_SEEDS = Object.freeze([515, 516, 517]);
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

function sourceRows() {
  const firstDraftPath = 'services/tutorStubFirstDraftContract.js';
  const firstDraft = read(firstDraftPath).toString('utf8');
  const partCues = objectLiteralMap(firstDraft, 'COMPACT_PART_CUES');
  const tacticCues = objectLiteralMap(firstDraft, 'TACTIC_EXECUTION_CUES');
  const stanceCues = functionObjectLiteralMap(firstDraft, 'compactStanceInstruction', 'cues');
  const actionCues = functionObjectLiteralMap(firstDraft, 'compactActionInstruction', 'cues');
  const rows = [
    fixedRow({ id: 'uptake.default', source: `${firstDraftPath}#compactUptakeInstruction.default`, prefix: 'When no narrower uptake branch applies, the compact uptake string is:', quote: 'Answer, credit, qualify, correct, or receive the learner’s concrete move; never use generic praise.' }),
    fixedRow({ id: 'uptake.accelerated', source: `${firstDraftPath}#compactUptakeInstruction.accelerated`, prefix: 'When the public contract records learner acceleration, the compact uptake addition is:', quote: 'Credit every warranted move; do not ask for it again.' }),
    templateRow({ id: 'uptake.learner_move', source: `${firstDraftPath}#compactUptakeInstruction.learnerMove`, prefix: 'When the public contract carries a learner move, this compact uptake template is rendered and the gate fills its named slot from the public contract:', fixedSegments: ['Carry forward this move: ', ''], slots: ['learner_move'] }),
    fixedRow({ id: 'uptake.writable_complementary', source: `${firstDraftPath}#compactUptakeInstruction.writable.complementary`, prefix: 'When a writable entry must precede complementary due evidence, the compact uptake string is:', quote: 'Begin exactly “Write:” with one learner-sayable pre-turn limit; do not preview or paraphrase SOURCE.' }),
    templateRow({ id: 'uptake.writable_causal', source: `${firstDraftPath}#compactUptakeInstruction.writable.causal`, prefix: 'When the public contract carries a causal subject and outcome, this compact uptake template is rendered and the gate fills its named slots from the public contract:', fixedSegments: ['Begin exactly “Write:” with this learner-sayable sentence: “The ', ' did not cause the ', '.” Keep both named roles exact; never widen either role or change cause into prevention.'], slots: ['causal_subject', 'causal_outcome'] }),
    fixedRow({ id: 'uptake.writable_causal_generic', source: `${firstDraftPath}#compactUptakeInstruction.writable.causal_generic`, prefix: 'When the public contract carries a causal relation without a named subject, the compact uptake string is:', quote: 'Begin exactly “Write:” with one learner-sayable sentence: the candidate was inactive while the outcome still occurred, so this rules out candidate causation. Preserve named actors and polarity; never say the candidate failed to prevent or stop the outcome.' }),
    fixedRow({ id: 'uptake.writable_record', source: `${firstDraftPath}#compactUptakeInstruction.writable.record`, prefix: 'When a writable entry can point to a rendered public record, the compact uptake string is:', quote: 'Begin exactly “Write:” with one learner-sayable sentence saying what one numbered RECORD line says. Preserve its actors, relation, and polarity; never reverse cause or evidentiary force, and claim nothing the line does not carry.' }),
    fixedRow({ id: 'uptake.writable_record_fallback', source: `${firstDraftPath}#compactUptakeInstruction.writable.record_fallback`, prefix: 'When a writable entry has no rendered public-record block, the compact uptake fallback is:', quote: 'Begin exactly “Write:” with one learner-sayable sentence licensed by the public record. Preserve actors, relation, and polarity; never reverse cause or evidentiary force.' }),
    fixedRow({ id: 'uptake.responsive_repair', source: `${firstDraftPath}#compactUptakeInstruction.responsive_repair`, prefix: 'When the public contract requires responsive repair, the compact uptake string is:', quote: 'Answer the learner’s unanswered question directly before doing anything else.' }),
    ...keyedRows(partCues, { idPrefix: 'part.compact_cue', sourceConstant: 'COMPACT_PART_CUES', prefix: (key) => `When the downstream selector carries the ${key.replaceAll('_', ' ')} part, its compact part cue is:` }),
    fixedRow({ id: 'part.inline.scene_partner', source: `${firstDraftPath}#compactPartInstruction.scene_partner`, prefix: 'When the selected part is scene partner, the live inline compact cue is:', quote: 'place both speakers at one named public object using “you”, “we”, or “together”; a solitary “I” beside the object does not count; do not ask a question yet' }),
    fixedRow({ id: 'part.fallback', source: `${firstDraftPath}#compactPartInstruction.fallback`, prefix: 'When no named compact part cue is available, the compact part fallback is:', quote: 'perform one concrete public action or judgment' }),
    fixedRow({ id: 'part.prop.existing', source: `${firstDraftPath}#compactPartInstruction.prop.existing`, prefix: 'When the public contract forbids a new prop, the compact part addition is:', quote: 'Use an already-named object; add no prop.' }),
    fixedRow({ id: 'part.prop.named', source: `${firstDraftPath}#compactPartInstruction.prop.named`, prefix: 'When the public contract permits a scene object, the compact part addition is:', quote: 'Name one public scene object.' }),
    templateRow({ id: 'part.wrapper', source: `${firstDraftPath}#compactPartInstruction.wrapper`, prefix: 'For every selected part, this compact wrapper is rendered and the gate fills its named slots from the public contract:', fixedSegments: ['As ', ', without naming the role, ', '.'], slots: ['actorial_part_label', 'compact_part_cue'] }),
    ...keyedRows(tacticCues, { idPrefix: 'tactic.execution', sourceConstant: 'TACTIC_EXECUTION_CUES', prefix: (key) => `When the compact tactic builder carries the ${key.replaceAll('_', ' ')} tactic, its execution cue is:` }),
    fixedRow({ id: 'tactic.support.3', source: `${firstDraftPath}#compactSupportInstruction.level_3`, prefix: 'When support level is three, the compact tactic support string is:', quote: 'Make the public connection explicit.' }),
    fixedRow({ id: 'tactic.support.2', source: `${firstDraftPath}#compactSupportInstruction.level_2`, prefix: 'When support level is two, the compact tactic support string is:', quote: 'Give one concrete hint, leaving the judgment open.' }),
    fixedRow({ id: 'tactic.support.1', source: `${firstDraftPath}#compactSupportInstruction.level_1`, prefix: 'When support level is one, the compact tactic support string is:', quote: 'Give only a light directional cue.' }),
    fixedRow({ id: 'tactic.source_boundary', source: `${firstDraftPath}#compactTacticInstruction.sourceBoundary`, prefix: 'When public source evidence is active, the compact tactic prefix is:', quote: 'After SOURCE closes, make TACTIC a new unquoted sentence.' }),
    fixedRow({ id: 'tactic.delivered_boundary', source: `${firstDraftPath}#compactTacticInstruction.transition`, prefix: 'When the requested pressure tactic is inapplicable, the compact tactic transition is:', quote: 'Use the delivered boundary tactic, not the requested pressure tactic.' }),
    fixedRow({ id: 'tactic.direction_only_rapid_handoff', source: `${firstDraftPath}#buildTutorStubFirstDraftContract.directionOnlyWithoutNewEvidence`, prefix: 'When direction-only support recasts rapid handoff, the compact tactic execution string is:', quote: 'Move straight from one already-public object or line to the present evidentiary limit. State the direction of the missing support yourself and end declaratively; do not ask the learner to name unseen evidence.' }),
    templateRow({ id: 'tactic.causal_performance', source: `${firstDraftPath}#typedCausalPerformanceInstruction`, prefix: 'When the public contract carries a causal subject and outcome, this tactic template is rendered and the gate fills its named slots from the public contract:', fixedSegments: ['Say “The ', ' did not cause the ', '; actual cause remains open.” Add no third clause or role change.'], slots: ['causal_subject', 'causal_outcome'] }),
    fixedRow({ id: 'tactic.question_boundary.handoff', source: `${firstDraftPath}#questionOwnedTacticExecution.boundary.handoff`, prefix: 'When the handoff owns an allowed question, the compact tactic boundary is:', quote: 'Ask no question here; HANDOFF owns it.' }),
    fixedRow({ id: 'tactic.question_boundary.none', source: `${firstDraftPath}#questionOwnedTacticExecution.boundary.none`, prefix: 'When the public contract forbids a question, the compact tactic boundary is:', quote: 'Ask no question here.' }),
    templateRow({ id: 'tactic.question_owned.rapid_handoff', source: `${firstDraftPath}#questionOwnedTacticExecution.rapid_handoff`, prefix: 'When rapid handoff delegates question ownership, this compact tactic template is rendered and the gate fills its named slot from the public contract:', fixedSegments: ['Move straight from the named public object or line to one short declarative observation. ', ''], slots: ['question_boundary'] }),
    templateRow({ id: 'tactic.question_owned.shared_scene_invitation', source: `${firstDraftPath}#questionOwnedTacticExecution.shared_scene_invitation`, prefix: 'When shared-scene invitation delegates question ownership, this compact tactic template is rendered and the gate fills its named slot from the public contract:', fixedSegments: ['Invite shared attention to the named public object declaratively using “you”, “we”, or “together”. ', ''], slots: ['question_boundary'] }),
    templateRow({ id: 'tactic.question_owned.general', source: `${firstDraftPath}#questionOwnedTacticExecution.general`, prefix: 'When another tactic delegates question ownership, this compact tactic template is rendered and the gate fills its named slots from the public contract:', fixedSegments: ['', ' ', ''], slots: ['tactic_execution', 'question_boundary'] }),
    ...keyedRows(stanceCues, { idPrefix: 'stance.compact_cue', sourceConstant: 'compactStanceInstruction.cues', prefix: (key) => `When the gate carries the ${key.replaceAll('_', ' ')} stance, its compact stance cue is:` }),
    templateRow({ id: 'stance.fallback', source: `${firstDraftPath}#compactStanceInstruction.fallback`, prefix: 'When the public contract carries an unlisted stance, this compact stance fallback is rendered and the gate fills its named slot from the public contract:', fixedSegments: ['Make it visibly ', '.'], slots: ['engagement_stance'] }),
    fixedRow({ id: 'handoff.settled', source: `${firstDraftPath}#compactProgressionHandoffInstruction.settled`, prefix: 'When the public contract names a settled surface, the compact handoff addition is:', quote: 'Do not reopen the settled point.' }),
    fixedRow({ id: 'handoff.bridge', source: `${firstDraftPath}#compactProgressionHandoffInstruction.bridge`, prefix: 'When the public contract requires a sibling-relation bridge, the compact handoff addition is:', quote: 'Connect SOURCE to the learner’s requested relation.' }),
    fixedRow({ id: 'handoff.declarative_fallback', source: `${firstDraftPath}#compactProgressionHandoffInstruction.declarative_fallback`, prefix: 'When declarative support has no supplied handoff instruction, the compact handoff fallback is:', quote: 'End declaratively; ask no question.' }),
    fixedRow({ id: 'handoff.public_limit', source: `${firstDraftPath}#compactProgressionHandoffInstruction.public_limit`, prefix: 'When questions are forbidden without another special branch, the compact handoff string is:', quote: 'State the current public limit through the selected action; ask no question.' }),
    fixedRow({ id: 'handoff.optional_question', source: `${firstDraftPath}#compactProgressionHandoffInstruction.optional_question`, prefix: 'When a handoff question is optional, the compact handoff string is:', quote: 'Carry the selected action to TURN FOCUS. HANDOFF may ask one final question there; otherwise end declaratively.' }),
    fixedRow({ id: 'handoff.source_question', source: `${firstDraftPath}#compactProgressionHandoffInstruction.source_question`, prefix: 'When active source evidence and stage-next-step require a handoff question, the compact handoff string is:', quote: 'Ask one HANDOFF question about what SOURCE changes, supports, or rules out.' }),
    templateRow({ id: 'handoff.action_question', source: `${firstDraftPath}#compactProgressionHandoffInstruction.action_question`, prefix: 'When the default handoff owns the final question, this compact handoff template is rendered and the gate fills its named slot from the public contract:', fixedSegments: ['', ' HANDOFF owns the one final question.'], slots: ['compact_action_instruction'] }),
    fixedRow({ id: 'handoff.bounded_choices', source: `${firstDraftPath}#buildHostPlan.bounded_choice`, prefix: 'When question-support state requires bounded choices, the compact handoff addition is:', quote: 'Express two or three recognizable public-safe choices declaratively; do not turn the list into a question.' }),
    fixedRow({ id: 'handoff.clarification_invitation', source: `${firstDraftPath}#buildHostPlan.clarification_invitation`, prefix: 'When question-support state requires a clarification invitation, the compact handoff addition is:', quote: 'Also say that the learner may ask for a direct explanation of one clue, connection, or term.' }),
    fixedRow({ id: 'action.override.closure', source: `${firstDraftPath}#compactActionInstruction.closure`, prefix: 'When the public contract requires closure, the compact action override is:', quote: 'State the licensed public finding and close the inquiry; ask no question.' }),
    fixedRow({ id: 'action.override.responsive_repair', source: `${firstDraftPath}#compactActionInstruction.responsive_repair`, prefix: 'When the public contract requires responsive repair, the compact action override is:', quote: 'End after the direct answer or one public way to check it; do not substitute another exercise.' }),
    fixedRow({ id: 'action.override.active_source', source: `${firstDraftPath}#compactActionInstruction.active_source`, prefix: 'When active source evidence carries stage-next-step, the compact action override is:', quote: 'Return SOURCE as one concrete question about what it changes, supports, or rules out.' }),
    ...keyedRows(actionCues, { idPrefix: 'action.compact_cue', sourceConstant: 'compactActionInstruction.cues', prefix: (key) => `When the gate carries the ${key.replaceAll('_', ' ')} action family, its compact action cue is:` }),
  ];
  return rows;
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

export function guardOutcomePilotPreparation({ worldPaths, seeds = OUTCOME_PILOT_SEEDS } = {}) {
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
        learner_profile: 'low_agency',
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
  const exclusions = OUTCOME_PILOT_EXCLUDED_ARTIFACTS.map((artifactPath) => {
    const resolved = path.isAbsolute(artifactPath) ? artifactPath : path.join(ROOT, artifactPath);
    if (!fs.existsSync(resolved)) throw new Error(`required excluded artifact is missing: ${artifactPath}`);
    const bytes = fs.readFileSync(resolved);
    const text = bytes.toString('utf8');
    const embeddedFingerprints = [...new Set(text.match(/[a-f0-9]{64}/gu) || [])];
    return {
      path: artifactPath,
      sha256: sha256(bytes),
      embedded_fingerprint_count: embeddedFingerprints.length,
      embedded_fingerprints: embeddedFingerprints,
      candidate_world_ids_present: worlds.filter((world) => text.includes(world.id)).map((world) => world.id),
    };
  });
  const exclusionFingerprints = new Set(
    exclusions.flatMap((row) => [row.sha256, ...row.embedded_fingerprints]).concat(
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
  const pass =
    worlds.length === 2 &&
    seeds.length === 3 &&
    candidates.length === 18 &&
    duplicates.length === 0 &&
    overlaps.length === 0 &&
    worldIdOverlaps.length === 0;
  return {
    schema: 'machinespirits.adaptation-refinement.outcome-preparation-fingerprint-guard.v1',
    zero_model_calls: true,
    status: pass ? 'passed' : 'failed',
    comparison_scope:
      'Pre-call prepared-run identities are compared with artifact digests and every embedded SHA-256 fingerprint in the burned corpora, the frozen seed-514 matrix, and the three registered archived-session identities. After generation, the same-source annotationCaseFingerprint guard remains mandatory before either reader channel.',
    worlds,
    seeds: [...seeds],
    conditions,
    prepared_run_count: candidates.length,
    candidate_fingerprints: candidateFingerprints,
    excluded_artifacts: exclusions.map(({ embedded_fingerprints: _omitted, ...row }) => row),
    deference_session_identities: [...OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES],
    exclusion_fingerprint_count: exclusionFingerprints.size,
    duplicate_candidate_fingerprints: [...new Set(duplicates)],
    overlapping_fingerprints: [...new Set(overlaps)],
    overlapping_world_ids: [...new Set(worldIdOverlaps)],
    post_generation_case_guard_required: true,
  };
}

export function buildOutcomeStandingPermissionMenu() {
  const rows = sourceRows();
  return {
    schema: OUTCOME_A1_MENU_SCHEMA,
    source_sha256: { ...OUTCOME_A1_SOURCE_PINS },
    enumeration_rule: { ...OUTCOME_A1_ENUMERATION_RULE },
    prefix_set: rows.map(({ id, prefix }) => ({ id, prefix })),
    entries: rows,
    menu_text: renderMenu(rows),
  };
}

export function guardOutcomeStandingPermissionMenu(material) {
  const sourceChecks = Object.fromEntries(
    Object.entries(OUTCOME_A1_SOURCE_PINS).map(([relativePath, expected]) => {
      const observed = sha256(read(relativePath));
      return [relativePath, { expected, observed, pass: observed === expected }];
    }),
  );
  const expectedRows = sourceRows();
  const actualRows = Array.isArray(material?.entries) ? material.entries : [];
  const expectedById = new Map(expectedRows.map((row) => [row.id, row]));
  const actualById = new Map(actualRows.map((row) => [row.id, row]));
  const duplicateIds = actualRows
    .map((row) => row.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const missing = expectedRows.filter((row) => !actualById.has(row.id)).map((row) => row.id);
  const unexpected = actualRows.filter((row) => !expectedById.has(row.id)).map((row) => row.id);
  const rowChecks = expectedRows.map((expected) => {
    const actual = actualById.get(expected.id);
    return {
      id: expected.id,
      quote_bytes_match: actual?.quote === expected.quote,
      fixed_segments_bytes_match:
        JSON.stringify(actual?.fixed_segments) === JSON.stringify(expected.fixed_segments),
      template_slots_match: JSON.stringify(actual?.template_slots) === JSON.stringify(expected.template_slots),
      prefix_bytes_match: actual?.prefix === expected.prefix,
      source_location_match: actual?.source === expected.source,
    };
  });
  const renderedMatches = material?.menu_text === renderMenu(actualRows);
  const pass =
    material?.schema === OUTCOME_A1_MENU_SCHEMA &&
    Object.values(sourceChecks).every((check) => check.pass) &&
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
