/**
 * Id-Director Engine
 *
 * Inverted multi-agent topology used by cells 101 (base) and 102 (recognition).
 *
 * Existing dialectical engine: Ego drafts → Superego critiques → Ego revises.
 * Here: Id authors a fresh ego system prompt this turn → Ego executes once.
 *
 * The "id" is metaphorical (per design brief). Mechanically it is a back-stage
 * authorial layer that writes the front-stage actor's role each turn.
 *
 * Design doc: notes/design-cell-100-id-director-charisma.md
 * Static prompt: prompts/tutor-id-director.md
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { jsonrepair } from 'jsonrepair';

import { tutorConfigLoader as defaultTutorConfig, tutorDialogueEngine } from '../tutor-core/index.js';
import * as defaultTutorWritingPad from './memory/tutorWritingPad.js';
import {
  callAIWithCliBridge as callWithCliBridge,
  cliAwareProviderConfig,
  isProviderConfigured,
} from './cliProviderBridge.js';
import { extractEngagementModeHistory, routeEngagementMode } from './engagementModeRouter.js';
import { getEngagementRegisterDefinition } from './engagementRegisterRegistry.js';

// Drop-in wrapper that routes repo-local CLI providers through subscription
// CLIs and everything else through tutor-core's metered callAI. Same return
// shape as tutorDialogueEngine.callAI so call sites swap in unchanged.
async function callAIWithCliBridge(agentConfig, systemPrompt, userPrompt, role, opts = {}) {
  return await callWithCliBridge(agentConfig, systemPrompt, userPrompt, role, {
    ...opts,
    fallbackCallAI: tutorDialogueEngine.callAI,
  });
}

const __engineFile = fileURLToPath(import.meta.url);
const __engineDir = path.dirname(__engineFile);
const PROMPTS_DIR = path.resolve(__engineDir, '..', 'prompts');

const _deps = {
  tutorConfig: defaultTutorConfig,
  tutorWritingPad: defaultTutorWritingPad,
};

function normalizeEngagementRegisterArm(value) {
  const arm = typeof value === 'string' ? value.trim() : '';
  if (!arm) return null;
  return getEngagementRegisterDefinition(arm) ? arm : null;
}

function applyEngagementRegisterArm(engagementState, assignedRegisterArm) {
  if (!engagementState || !assignedRegisterArm) return engagementState;
  const selectedRegister = engagementState.selected_register || engagementState.selected_mode;
  if (selectedRegister !== 'charismatic_challenge') return engagementState;
  const definition = getEngagementRegisterDefinition(assignedRegisterArm);
  if (!definition) return engagementState;
  const baseReason = engagementState.register_reason || engagementState.mode_reason || '';
  const assignedReason = `${baseReason} Experiment arm assigns ${assignedRegisterArm} under the same resistant precondition.`.trim();
  return {
    ...engagementState,
    router_selected_register: selectedRegister,
    router_selected_mode: engagementState.selected_mode || selectedRegister,
    selected_register: assignedRegisterArm,
    selected_mode: assignedRegisterArm,
    assigned_register_arm: assignedRegisterArm,
    register_assignment_source: 'experiment_arm',
    register_valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    register_reason: assignedReason,
    mode_reason: assignedReason,
  };
}

function buildRegisterStanceContract(engagementState) {
  const registerName = engagementState?.selected_register || engagementState?.selected_mode;
  const definition = getEngagementRegisterDefinition(registerName);
  if (!registerName || !definition) return null;
  return {
    selected_register: registerName,
    valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    stance_contract: definition.stance_contract || '',
    stance_fidelity_cues: definition.stance_fidelity_cues || [],
    forbidden_phrases: definition.forbidden_phrases || [],
    required_moves: definition.required_moves || [],
    risk_flags: definition.risk_flags || [],
    recognition_guardrail: definition.recognition_guardrail || '',
  };
}

export function __setDeps(overrides = {}) {
  if (overrides.tutorConfig) _deps.tutorConfig = overrides.tutorConfig;
  if (overrides.tutorWritingPad) _deps.tutorWritingPad = overrides.tutorWritingPad;
}

export function __resetDeps() {
  _deps.tutorConfig = defaultTutorConfig;
  _deps.tutorWritingPad = defaultTutorWritingPad;
}

const FALLBACK_GENERATED_PROMPT =
  'You are an attentive tutor with a definite voice. Read what the learner just said. ' +
  'Respond in a way that has shape — an opening, a peak, a closing — and that carries ' +
  'felt warmth without performing it. Keep your reply short. End with one specific ' +
  'question that asks the learner to take a position rather than seek more information.';

const MIN_GENERATED_PROMPT_CHARS = 100;
const EGO_EMPTY_RETRY_SUFFIX =
  'Return only the tutor response the learner should see, as plain text. ' +
  'Do not explain your reasoning, describe the prompt, or output JSON.';
const AGENCY_RETURN_VERIFIER_MAX_TOKENS = 4000;
const AGENCY_RETURN_VERIFIER_RETRY_SUFFIX =
  'Return only the required JSON object now. Do not include analysis, headings, markdown, or prose outside the JSON.';
const AGENCY_RETURN_VERIFIER_MODE_STRICT = 'strict';
const AGENCY_RETURN_VERIFIER_MODE_WARMTH_PRESERVING = 'warmth_preserving';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_STANDARD = 'standard';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_COMPACT = 'compact';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ARC = 'arc';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_GUARDED_ARC = 'guarded_arc';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_AFFECTIVE_SCENE = 'affective_scene';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID = 'accountable_bid';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_CLEAN = 'accountable_bid_clean';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN = 'accountable_bid_transfer_plain';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_PRESENCE =
  'accountable_bid_transfer_plain_presence';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT = 'accountable_bid_transfer_plain_split';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK =
  'accountable_bid_transfer_plain_split_check';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR =
  'accountable_bid_transfer_plain_split_check_anchor';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE =
  'accountable_bid_transfer_plain_split_check_anchor_live';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_PERSIST =
  'accountable_bid_transfer_plain_split_check_anchor_live_persist';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED =
  'accountable_bid_transfer_plain_split_check_anchor_live_lived';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_COMPRESS =
  'accountable_bid_transfer_plain_split_check_anchor_live_lived_compress';
const AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_CHARGED_CHECK =
  'accountable_bid_transfer_plain_split_check_anchor_live_lived_charged_check';
const ID_OUTPUT_CONTRACT_STANDARD = 'standard';
const ID_OUTPUT_CONTRACT_STRICT_COMPACT_JSON = 'strict_compact_json';
const AGENCY_RETURN_VERIFIER_PROMPT = `You are an agency-return verifier for a charismatic tutor.

Read the learner message, curriculum context, and drafted tutor response. Decide whether the response contains at least one concrete agency-return move:
- "test": asks the learner to test the tutor's claim, image, or phrase against a passage, case, objection, or example.
- "resay": asks the learner to restate, translate, flatten, reject, or correct the idea in their own words.
- "anchor": ties an admired phrase or tutor claim to a named content feature, then asks the learner to decide whether that anchor supports it.

Do not reward generic follow-up questions, requests for admiration, requests to continue, vague "does that make sense" checks, or purely rhetorical endings.

Return only one JSON object:
{
  "passes": true | false,
  "move_type": "test" | "resay" | "anchor" | "missing",
  "reason": "one short sentence",
  "repaired_response": ""
}

If passes is false, repaired_response must be a complete learner-facing tutor response. Preserve the original response's best content and voice, but add one agency-return move. Do not add meta-commentary. If passes is true, repaired_response must be an empty string.`;

const AGENCY_RETURN_VERIFIER_WARMTH_PRESERVING_PROMPT = `You are a warmth-preserving agency-return verifier for a charismatic tutor.

Read the learner message, curriculum context, and drafted tutor response. Decide whether the response contains at least one concrete agency-return move:
- "test": asks the learner to test the tutor's claim, image, or phrase against a passage, case, objection, or example.
- "resay": asks the learner to restate, translate, flatten, reject, or correct the idea in their own words.
- "anchor": ties an admired phrase or tutor claim to a named content feature, then asks the learner to decide whether that anchor supports it.

This verifier is for partial uptake: the learner has felt the tutor's phrase or presence, but does not yet fully own it. Protect the draft's charisma, warmth, address, rhythm, and earned status. Do not cool the response into generic pedagogy.

Do not reward generic follow-up questions, requests for admiration, requests to continue, vague "does that make sense" checks, or purely rhetorical endings. Also reject premature-certainty praise: if the drafted tutor response uses "exactly" or "excellent" for the learner's partial uptake, passes must be false even when an agency-return move is present.

Return only one JSON object:
{
  "passes": true | false,
  "move_type": "test" | "resay" | "anchor" | "missing",
  "reason": "one short sentence",
  "agency_return_append": "",
  "repaired_response": ""
}

If passes is false only because the response lacks an agency-return move, prefer agency_return_append: write one short learner-facing sentence or question that can be appended to the original response without replacing it. The append must ask the learner to test, re-say, reject, correct, or anchor the idea in course content. If passes is false because the draft uses "exactly" or "excellent", use repaired_response instead: preserve the best image and handback, but remove the forbidden premature-certainty word. If you must replace the whole response for any other reason, put the complete replacement in repaired_response and leave agency_return_append empty. If passes is true, agency_return_append and repaired_response must both be empty strings.`;

function normalizeAgencyReturnVerifierMode(mode) {
  return mode === AGENCY_RETURN_VERIFIER_MODE_WARMTH_PRESERVING
    ? AGENCY_RETURN_VERIFIER_MODE_WARMTH_PRESERVING
    : AGENCY_RETURN_VERIFIER_MODE_STRICT;
}

function getAgencyReturnVerifierPrompt(mode) {
  return mode === AGENCY_RETURN_VERIFIER_MODE_WARMTH_PRESERVING
    ? AGENCY_RETURN_VERIFIER_WARMTH_PRESERVING_PROMPT
    : AGENCY_RETURN_VERIFIER_PROMPT;
}

function getAgencyReturnRepairMode(mode) {
  return mode === AGENCY_RETURN_VERIFIER_MODE_WARMTH_PRESERVING ? 'append' : 'replace';
}

function normalizeAgencyReturnCharismaFloorMode(mode) {
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_COMPACT) return AGENCY_RETURN_CHARISMA_FLOOR_MODE_COMPACT;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ARC) return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ARC;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_GUARDED_ARC) return AGENCY_RETURN_CHARISMA_FLOOR_MODE_GUARDED_ARC;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_AFFECTIVE_SCENE)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_AFFECTIVE_SCENE;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_CLEAN)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_CLEAN;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_PRESENCE)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_PRESENCE;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_PERSIST)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_PERSIST;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED;
  if (mode === AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_COMPRESS)
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_COMPRESS;
  if (
    mode ===
    AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_CHARGED_CHECK
  )
    return AGENCY_RETURN_CHARISMA_FLOOR_MODE_ACCOUNTABLE_BID_TRANSFER_PLAIN_SPLIT_CHECK_ANCHOR_LIVE_LIVED_CHARGED_CHECK;
  return AGENCY_RETURN_CHARISMA_FLOOR_MODE_STANDARD;
}

function normalizeIdOutputContract(mode) {
  return mode === ID_OUTPUT_CONTRACT_STRICT_COMPACT_JSON
    ? ID_OUTPUT_CONTRACT_STRICT_COMPACT_JSON
    : ID_OUTPUT_CONTRACT_STANDARD;
}

function getRequiredTemperature(config, configName) {
  const t = config?.hyperparameters?.temperature;
  if (t === undefined) {
    throw new Error(`Explicit temperature setting is required for ${configName} in YAML config.`);
  }
  return t;
}

function getRequiredMaxTokens(config, configName) {
  const m = config?.hyperparameters?.max_tokens;
  if (m === undefined) {
    throw new Error(`Explicit max_tokens setting is required for ${configName} in YAML config.`);
  }
  return m;
}

function buildConversationContext(history) {
  if (!Array.isArray(history) || history.length === 0) return '(no prior turns)';
  return history
    .slice(-6)
    .map((m) => `${(m.role || '').toUpperCase()}: ${m.content || ''}`)
    .join('\n\n');
}

function buildEgoRetryPrompt(learnerMessage) {
  return `${learnerMessage}\n\n${EGO_EMPTY_RETRY_SUFFIX}`;
}

function buildAgencyReturnVerifierUserMessage({ learnerMessage, curriculumContext, tutorResponse }) {
  return [
    '<current_learner_message>',
    learnerMessage || '',
    '</current_learner_message>',
    '',
    '<curriculum_context>',
    curriculumContext || '(no curriculum context provided)',
    '</curriculum_context>',
    '',
    '<draft_tutor_response>',
    tutorResponse || '',
    '</draft_tutor_response>',
  ].join('\n');
}

function buildAgencyReturnVerifierRetryUserMessage(userMessage) {
  return `${userMessage}\n\n${AGENCY_RETURN_VERIFIER_RETRY_SUFFIX}`;
}

function fallbackAgencyReturnVerification(reason, rawText = '') {
  return {
    passes: true,
    move_type: 'unknown',
    reason: `Verifier parse failed (${reason}); leaving response unchanged.`,
    repaired_response: '',
    parse_status: 'fallback',
    parse_failure_reason: reason,
    raw_head: rawText ? rawText.slice(0, 200) : '',
  };
}

function buildIdUserMessage({
  conversationContext,
  learnerMessage,
  curriculumContext,
  tutorMemory,
  previousPersona,
  recognitionMode,
  recognitionDesire = false,
  agencyReturn = false,
  agencyReturnVerifierMode = AGENCY_RETURN_VERIFIER_MODE_STRICT,
  agencyReturnCharismaFloor = false,
  agencyReturnCharismaFloorMode = AGENCY_RETURN_CHARISMA_FLOOR_MODE_STANDARD,
  idOutputContract = ID_OUTPUT_CONTRACT_STANDARD,
  engagementRouterCharismaRepair = false,
  engagementRouterSplitRepair = false,
  engagementRouterTransferStakeRepair = false,
  engagementRouterTransferCompressionRepair = false,
  engagementRouterResistanceTuning = false,
  engagementRouterResistanceOwnedTest = false,
  engagementRouterResistancePrecisionRepair = false,
  engagementRouterResistanceGenerationRepair = false,
  engagementRouterResistanceQuestionLock = false,
  engagementRouterResistanceCommitmentProbe = false,
  engagementRouterResistanceBoredomStake = false,
  engagementRouterResistanceGlmCompact = false,
  agencyReturnPrematureCertaintyGuard = false,
  engagementState = null,
  learnerRegister = null,
}) {
  const lines = [
    '<dialogue_history>',
    conversationContext,
    '</dialogue_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
    '',
    '<curriculum_context>',
    curriculumContext || '(no curriculum context provided)',
    '',
    'Memory of this learner:',
    tutorMemory || '(no prior history with this learner)',
    '</curriculum_context>',
    '',
    '<previous_persona>',
    previousPersona,
    '</previous_persona>',
    '',
    '<recognition_mode>',
    recognitionMode ? 'true' : 'false',
    '</recognition_mode>',
    '',
    '<recognition_desire>',
    recognitionDesire ? 'true' : 'false',
    '</recognition_desire>',
    '',
    '<agency_return>',
    agencyReturn ? 'true' : 'false',
    '</agency_return>',
    '',
    '<agency_return_verifier_mode>',
    normalizeAgencyReturnVerifierMode(agencyReturnVerifierMode),
    '</agency_return_verifier_mode>',
    '',
    '<agency_return_charisma_floor>',
    agencyReturnCharismaFloor ? 'true' : 'false',
    '</agency_return_charisma_floor>',
    '',
    '<agency_return_charisma_floor_mode>',
    normalizeAgencyReturnCharismaFloorMode(agencyReturnCharismaFloorMode),
    '</agency_return_charisma_floor_mode>',
    '',
    '<id_output_contract>',
    normalizeIdOutputContract(idOutputContract),
    '</id_output_contract>',
    '',
    '<engagement_router_charisma_repair>',
    engagementRouterCharismaRepair ? 'true' : 'false',
    '</engagement_router_charisma_repair>',
    '',
    '<engagement_router_split_repair>',
    engagementRouterSplitRepair ? 'true' : 'false',
    '</engagement_router_split_repair>',
    '',
    '<engagement_router_transfer_stake_repair>',
    engagementRouterTransferStakeRepair ? 'true' : 'false',
    '</engagement_router_transfer_stake_repair>',
    '',
    '<engagement_router_transfer_compression_repair>',
    engagementRouterTransferCompressionRepair ? 'true' : 'false',
    '</engagement_router_transfer_compression_repair>',
    '',
    '<engagement_router_resistance_tuning>',
    engagementRouterResistanceTuning ? 'true' : 'false',
    '</engagement_router_resistance_tuning>',
    '',
    '<engagement_router_resistance_owned_test>',
    engagementRouterResistanceOwnedTest ? 'true' : 'false',
    '</engagement_router_resistance_owned_test>',
    '',
    '<engagement_router_resistance_precision_repair>',
    engagementRouterResistancePrecisionRepair ? 'true' : 'false',
    '</engagement_router_resistance_precision_repair>',
    '',
    '<engagement_router_resistance_generation_repair>',
    engagementRouterResistanceGenerationRepair ? 'true' : 'false',
    '</engagement_router_resistance_generation_repair>',
    '',
    '<engagement_router_resistance_question_lock>',
    engagementRouterResistanceQuestionLock ? 'true' : 'false',
    '</engagement_router_resistance_question_lock>',
    '',
    '<engagement_router_resistance_commitment_probe>',
    engagementRouterResistanceCommitmentProbe ? 'true' : 'false',
    '</engagement_router_resistance_commitment_probe>',
    '',
    '<engagement_router_resistance_boredom_stake>',
    engagementRouterResistanceBoredomStake ? 'true' : 'false',
    '</engagement_router_resistance_boredom_stake>',
    '',
    '<engagement_router_resistance_glm_compact>',
    engagementRouterResistanceGlmCompact ? 'true' : 'false',
    '</engagement_router_resistance_glm_compact>',
    '',
    '<agency_return_premature_certainty_guard>',
    agencyReturnPrematureCertaintyGuard ? 'true' : 'false',
    '</agency_return_premature_certainty_guard>',
  ];
  if (engagementState && typeof engagementState === 'object') {
    const idVisibleEngagementState = { ...engagementState };
    if (
      !engagementRouterResistanceTuning &&
      !engagementRouterResistanceOwnedTest &&
      !engagementRouterResistancePrecisionRepair &&
      !engagementRouterResistanceGenerationRepair &&
      !engagementRouterResistanceQuestionLock &&
      !engagementRouterResistanceCommitmentProbe &&
      !engagementRouterResistanceBoredomStake &&
      !engagementRouterResistanceGlmCompact
    ) {
      delete idVisibleEngagementState.resistance_strategy;
      delete idVisibleEngagementState.resistance_move;
    }
    lines.push('', '<engagement_state>', JSON.stringify(idVisibleEngagementState, null, 2), '</engagement_state>');
    const registerContract = buildRegisterStanceContract(engagementState);
    if (registerContract) {
      lines.push(
        '',
        '<register_stance_contract>',
        JSON.stringify(registerContract, null, 2),
        '</register_stance_contract>',
      );
    }
  }
  if (learnerRegister && typeof learnerRegister === 'object') {
    lines.push('', '<learner_register>', JSON.stringify(learnerRegister, null, 2), '</learner_register>');
  }
  return lines.join('\n');
}

function fallbackConstruction(reason, rawText = '') {
  return {
    generated_prompt: FALLBACK_GENERATED_PROMPT,
    persona_delta: 'FALLBACK',
    stage_directions: `id-director output failed parsing (${reason}); using minimal fallback persona`,
    reasoning: `Parse failure: ${reason}.${rawText ? ` Raw head: ${rawText.slice(0, 200)}` : ''}`,
    parse_status: 'fallback',
    parse_failure_reason: reason,
  };
}

function stripLooseFieldValue(value) {
  if (!value || typeof value !== 'string') return '';
  let out = value.trim();
  out = out.replace(/^[`'"]/, '');
  out = out.replace(/,\s*$/, '').trim();
  out = out.replace(/[`'"]\s*$/, '').trim();
  out = out.replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function extractLooseJsonField(rawText, fieldName, followingFieldNames = []) {
  if (!rawText || typeof rawText !== 'string') return '';
  const fieldPattern = new RegExp(`["']?${fieldName}["']?\\s*:`);
  const match = fieldPattern.exec(rawText);
  if (!match) return '';

  const start = match.index + match[0].length;
  let end = rawText.length;
  for (const nextField of followingFieldNames) {
    const nextPattern = new RegExp(`[,\\s]*["']?${nextField}["']?\\s*:`);
    const nextMatch = nextPattern.exec(rawText.slice(start));
    if (nextMatch) {
      end = Math.min(end, start + nextMatch.index);
    }
  }

  return stripLooseFieldValue(rawText.slice(start, end));
}

function cleanLooseTraceField(value) {
  return String(value || '')
    .replace(/["'`].*$/, '')
    .trim();
}

function salvageIdConstruction(rawText, reason) {
  const generatedPrompt = extractLooseJsonField(rawText, 'generated_prompt', [
    'persona_delta',
    'stage_directions',
    'reasoning',
  ]);
  if (generatedPrompt.length < MIN_GENERATED_PROMPT_CHARS) {
    return fallbackConstruction(reason, rawText);
  }

  const personaDelta = cleanLooseTraceField(
    extractLooseJsonField(rawText, 'persona_delta', ['stage_directions', 'reasoning']),
  );
  const stageDirections = cleanLooseTraceField(extractLooseJsonField(rawText, 'stage_directions', ['reasoning']));
  const reasoning = cleanLooseTraceField(extractLooseJsonField(rawText, 'reasoning'));

  return {
    generated_prompt: generatedPrompt,
    persona_delta: personaDelta || 'SALVAGED',
    stage_directions: stageDirections,
    reasoning: reasoning || `Salvaged generated_prompt from malformed id JSON after parse failure: ${reason}`,
    parse_status: 'salvaged_from_malformed_json',
    parse_failure_reason: reason,
  };
}

const VALID_REGISTER_TAGS = new Set([
  'vulnerable_disclosure',
  'sceptical_pushback',
  'operational_request',
  'meta_observation',
  'analytic_engagement',
  'curious_invitation',
  'disengaged',
]);

/**
 * Parse the register classifier's JSON output. Tolerant of code-fence
 * wrapping and minor formatting noise; falls back to {register: 'unknown',
 * confidence: 0} on any parse failure so the id can still author normally.
 */
export function parseRegisterClassification(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { register: 'unknown', confidence: 0, evidence: '', shift_from_previous: null, parse_status: 'empty' };
  }
  let text = rawText.trim();
  const openFence = text.match(/^```(?:json)?\s*/);
  if (openFence) {
    text = text.slice(openFence[0].length);
    const closeFence = text.lastIndexOf('```');
    if (closeFence !== -1) text = text.slice(0, closeFence).trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(text));
    } catch {
      return {
        register: 'unknown',
        confidence: 0,
        evidence: '',
        shift_from_previous: null,
        parse_status: 'parse_error',
      };
    }
  }
  const register = VALID_REGISTER_TAGS.has(parsed?.register) ? parsed.register : 'unknown';
  const confidenceRaw = parsed?.confidence;
  const confidence = typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : 0;
  return {
    register,
    confidence,
    evidence: typeof parsed?.evidence === 'string' ? parsed.evidence : '',
    shift_from_previous: typeof parsed?.shift_from_previous === 'boolean' ? parsed.shift_from_previous : null,
    parse_status: register === 'unknown' ? 'invalid_register' : 'ok',
  };
}

/**
 * Classify the register of the learner's most recent message using a small
 * focused prompt (prompts/learner-register-classifier.md). Used by cells 103
 * and 104. The result is injected into the id's user message as a
 * <learner_register> field, which the id consumes to bias persona authoring
 * toward register-appropriate moves (witnessing vs firm vs concrete).
 *
 * Reuses the id's model and provider config (via classifierConfig). Budget
 * is small (max_tokens 800) — the prompt asks for a one-line JSON envelope.
 *
 * @param {Object} params
 * @param {string} params.learnerMessage
 * @param {string} params.recentHistory  - last few turns as plain prose
 * @param {Object} params.classifierConfig - { provider, providerConfig, model, hyperparameters, prompt }
 * @returns {Promise<Object>} { register, confidence, evidence, shift_from_previous, parse_status }
 */
export async function classifyLearnerRegister({ learnerMessage, recentHistory, classifierConfig }) {
  const userMessage = [
    '<recent_history>',
    recentHistory || '(no prior turns)',
    '</recent_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
  ].join('\n');

  const response = await callAIWithCliBridge(
    classifierConfig,
    classifierConfig.prompt,
    userMessage,
    'tutor_register_classifier',
    {},
  );
  const classification = parseRegisterClassification(response?.text || '');
  return {
    ...classification,
    metrics: {
      provider: classifierConfig.provider,
      model: classifierConfig.model,
      inputTokens: response?.inputTokens || 0,
      outputTokens: response?.outputTokens || 0,
    },
  };
}

export function parseIdConstruction(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackConstruction('empty_or_non_string_response', String(rawText || ''));
  }

  let text = rawText.trim();

  // Strip ```json fences if present. Use a tolerant pattern: opening fence
  // is required; closing fence is optional (responses may be truncated at
  // the model's max_tokens before the closing fence is emitted).
  const openFence = text.match(/^```(?:json)?\s*/);
  if (openFence) {
    text = text.slice(openFence[0].length);
    const closeFence = text.lastIndexOf('```');
    if (closeFence !== -1) text = text.slice(0, closeFence).trim();
  }

  // Narrow to the outermost {...} if there's preamble/postamble.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace !== -1) {
    // No closing brace (truncation). Take everything from { onward; jsonrepair
    // will try to close it.
    text = text.slice(firstBrace);
  }

  let parsed;
  let usedRepair = false;
  try {
    parsed = JSON.parse(text);
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(text);
      parsed = JSON.parse(repaired);
      usedRepair = true;
    } catch (repairErr) {
      const reason = `json_parse_error: ${firstErr.message} (jsonrepair also failed: ${repairErr.message})`;
      if (options.salvageMalformedJson === true) {
        return salvageIdConstruction(rawText, reason);
      }
      return fallbackConstruction(reason, rawText);
    }
  }

  if (
    !parsed ||
    typeof parsed.generated_prompt !== 'string' ||
    parsed.generated_prompt.length < MIN_GENERATED_PROMPT_CHARS
  ) {
    return fallbackConstruction('parse_succeeded_but_invalid_shape', rawText);
  }

  return {
    generated_prompt: parsed.generated_prompt,
    persona_delta: typeof parsed.persona_delta === 'string' ? parsed.persona_delta : 'UNKNOWN',
    stage_directions: typeof parsed.stage_directions === 'string' ? parsed.stage_directions : '',
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    parse_status: usedRepair ? 'ok_via_jsonrepair' : 'ok',
  };
}

export function parseAgencyReturnVerification(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackAgencyReturnVerification('empty_or_non_string_response', String(rawText || ''));
  }

  let text = rawText.trim();
  const openFence = text.match(/^```(?:json)?\s*/);
  if (openFence) {
    text = text.slice(openFence[0].length);
    const closeFence = text.lastIndexOf('```');
    if (closeFence !== -1) text = text.slice(0, closeFence).trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace !== -1) {
    text = text.slice(firstBrace);
  }

  let parsed;
  let usedRepair = false;
  try {
    parsed = JSON.parse(text);
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(text);
      parsed = JSON.parse(repaired);
      usedRepair = true;
    } catch (repairErr) {
      return fallbackAgencyReturnVerification(
        `json_parse_error: ${firstErr.message} (jsonrepair also failed: ${repairErr.message})`,
        rawText,
      );
    }
  }

  const passes = parsed?.passes === true;
  const moveType = ['test', 'resay', 'anchor', 'missing'].includes(parsed?.move_type)
    ? parsed.move_type
    : passes
      ? 'test'
      : 'missing';
  const repairedResponse = typeof parsed?.repaired_response === 'string' ? parsed.repaired_response.trim() : '';
  const agencyReturnAppend = typeof parsed?.agency_return_append === 'string' ? parsed.agency_return_append.trim() : '';

  if (!passes && !repairedResponse && !agencyReturnAppend) {
    return fallbackAgencyReturnVerification('missing_repaired_response_for_failed_verification', rawText);
  }

  return {
    passes,
    move_type: moveType,
    reason: typeof parsed?.reason === 'string' ? parsed.reason : '',
    repaired_response: passes ? '' : repairedResponse,
    agency_return_append: passes ? '' : agencyReturnAppend,
    parse_status: usedRepair ? 'ok_via_jsonrepair' : 'ok',
  };
}

function applyAgencyReturnVerification(tutorResponse, verification, options = {}) {
  if (!verification || verification.passes) {
    return { message: tutorResponse, repaired: false };
  }
  if (options.repairMode === 'append' && verification.agency_return_append) {
    return {
      message: `${String(tutorResponse || '').trim()}\n\n${verification.agency_return_append}`.trim(),
      repaired: true,
    };
  }
  if (verification.repaired_response) {
    return { message: verification.repaired_response, repaired: true };
  }
  if (verification.agency_return_append) {
    return {
      message: `${String(tutorResponse || '').trim()}\n\n${verification.agency_return_append}`.trim(),
      repaired: true,
    };
  }
  return { message: tutorResponse, repaired: false };
}

function applyPrematureCertaintyGuard(tutorResponse, options = {}) {
  const selectedRegister = options?.engagementState?.selected_register || options?.engagementState?.selected_mode || '';

  let message = String(tutorResponse || '');
  const replacements = [];
  const rules = [
    { pattern: /\bThat is exactly\b/g, replacement: 'That starts to name' },
    { pattern: /\bthat is exactly\b/g, replacement: 'that starts to name' },
    { pattern: /\bThat's exactly\b/g, replacement: 'That starts to name' },
    { pattern: /\bthat's exactly\b/g, replacement: 'that starts to name' },
    { pattern: /\bYou are exactly right\b/g, replacement: 'You have a real foothold' },
    { pattern: /\byou are exactly right\b/g, replacement: 'you have a real foothold' },
    { pattern: /\bexactly right\b/g, replacement: 'partly right' },
    { pattern: /\bExcellent\b/g, replacement: 'Useful' },
    { pattern: /\bexcellent\b/g, replacement: 'useful' },
  ];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(message)) {
      replacements.push(rule.pattern.source);
      rule.pattern.lastIndex = 0;
      message = message.replace(rule.pattern, rule.replacement);
    }
  }

  return {
    message,
    repaired: message !== String(tutorResponse || ''),
    reason: replacements.length
      ? `premature_certainty_wording_removed${selectedRegister ? `_in_${selectedRegister}` : ''}`
      : 'no_premature_certainty_wording_found',
    replacements,
  };
}

export function extractPreviousPersona(trace) {
  if (!trace || !Array.isArray(trace.turns) || trace.turns.length === 0) {
    return 'FIRST_TURN';
  }

  for (let i = trace.turns.length - 1; i >= 0; i -= 1) {
    const turn = trace.turns[i];
    if (turn?.phase !== 'tutor') continue;
    const deliberation = Array.isArray(turn.internalDeliberation) ? turn.internalDeliberation : [];
    const idEntry = deliberation.find((d) => d?.role === 'id');
    if (idEntry?.construction?.generated_prompt) {
      const reasoning = idEntry.construction.reasoning || '';
      const personaDelta = idEntry.construction.persona_delta || '';
      const head = idEntry.construction.generated_prompt.slice(0, 240);
      return [
        `last_persona_delta: ${personaDelta}`,
        reasoning ? `last_reasoning: ${reasoning}` : null,
        `last_generated_prompt_head: ${head}${idEntry.construction.generated_prompt.length > 240 ? '...' : ''}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  return 'FIRST_TURN';
}

function buildIdDeliberationEntry(idResponse, idConfig, construction) {
  return {
    role: 'id',
    content: idResponse?.content || '',
    metrics: {
      model: idResponse?.model || idConfig?.model || null,
      provider: idResponse?.provider || idConfig?.provider || null,
      latencyMs: idResponse?.latencyMs ?? null,
      inputTokens: idResponse?.usage?.inputTokens ?? 0,
      outputTokens: idResponse?.usage?.outputTokens ?? 0,
      generationId: idResponse?.generationId || null,
    },
    construction,
    apiPayload: idResponse?.apiPayload || null,
  };
}

function buildEgoDeliberationEntry(egoResponse, egoConfig, renderedSystemPrompt) {
  return {
    role: 'ego',
    content: egoResponse?.content || '',
    metrics: {
      model: egoResponse?.model || egoConfig?.model || null,
      provider: egoResponse?.provider || egoConfig?.provider || null,
      latencyMs: egoResponse?.latencyMs ?? null,
      inputTokens: egoResponse?.usage?.inputTokens ?? 0,
      outputTokens: egoResponse?.usage?.outputTokens ?? 0,
      generationId: egoResponse?.generationId || null,
    },
    rendered_system_prompt: renderedSystemPrompt,
    apiPayload: egoResponse?.apiPayload || null,
  };
}

function buildAgencyReturnVerifierDeliberationEntry(verifierResponse, idConfig, verification) {
  return {
    role: 'agency_return_verifier',
    content: verifierResponse?.content || '',
    metrics: {
      model: verifierResponse?.model || idConfig?.model || null,
      provider: verifierResponse?.provider || idConfig?.provider || null,
      latencyMs: verifierResponse?.latencyMs ?? null,
      inputTokens: verifierResponse?.usage?.inputTokens ?? 0,
      outputTokens: verifierResponse?.usage?.outputTokens ?? 0,
      generationId: verifierResponse?.generationId || null,
    },
    verification,
    apiPayload: verifierResponse?.apiPayload || null,
  };
}

/**
 * Run a single id-directed tutor turn.
 *
 * Same signature as the existing runTutorTurn so the dispatch in
 * learnerTutorInteractionEngine.js is a single conditional. Returns the
 * same shape ({externalMessage, rawResponse, internalDeliberation, strategy,
 * suggestsEnding}) so downstream code is unchanged.
 *
 * Recognition mode is read from the tutor profile's recognition_mode field
 * (true for cell 102, false for cell 101).
 */
export async function runIdDirectedTurn({
  learnerId,
  sessionId,
  learnerMessage,
  history,
  tutorProfileName,
  topic,
  llmCall,
  trace,
}) {
  const profile = _deps.tutorConfig.getActiveProfile(tutorProfileName) || {};
  const egoConfig = _deps.tutorConfig.getAgentConfig('ego', tutorProfileName);
  const idConfig = _deps.tutorConfig.getAgentConfig('superego', tutorProfileName);

  if (!idConfig) {
    throw new Error(
      'Cell with factors.id_director:true must configure an agent slot for the id ' +
        '(currently re-uses the superego: block in tutor-agents.yaml).',
    );
  }

  const recognitionMode = profile?.recognition_mode === true;
  const recognitionDesire = profile?.factors?.recognition_desire === true || profile?.recognition_desire === true;
  const agencyReturn = profile?.factors?.agency_return === true || profile?.agency_return === true;
  const agencyReturnVerifier =
    profile?.factors?.agency_return_verifier === true || profile?.agency_return_verifier === true;
  const agencyReturnCharismaFloor =
    profile?.factors?.agency_return_charisma_floor === true || profile?.agency_return_charisma_floor === true;
  const engagementModeRouter =
    profile?.factors?.engagement_mode_router === true || profile?.engagement_mode_router === true;
  const engagementRegisterArm = normalizeEngagementRegisterArm(
    profile?.factors?.engagement_register_arm || profile?.engagement_register_arm,
  );
  const idOutputContract = normalizeIdOutputContract(
    profile?.factors?.id_output_contract || profile?.id_output_contract,
  );
  const engagementRouterCharismaRepair =
    profile?.factors?.engagement_router_charisma_repair === true || profile?.engagement_router_charisma_repair === true;
  const engagementRouterSplitRepair =
    profile?.factors?.engagement_router_split_repair === true || profile?.engagement_router_split_repair === true;
  const engagementRouterTransferStakeRepair =
    profile?.factors?.engagement_router_transfer_stake_repair === true ||
    profile?.engagement_router_transfer_stake_repair === true;
  const engagementRouterTransferCompressionRepair =
    profile?.factors?.engagement_router_transfer_compression_repair === true ||
    profile?.engagement_router_transfer_compression_repair === true;
  const engagementRouterResistanceTuning =
    profile?.factors?.engagement_router_resistance_tuning === true ||
    profile?.engagement_router_resistance_tuning === true;
  const engagementRouterResistanceOwnedTest =
    profile?.factors?.engagement_router_resistance_owned_test === true ||
    profile?.engagement_router_resistance_owned_test === true;
  const engagementRouterResistancePrecisionRepair =
    profile?.factors?.engagement_router_resistance_precision_repair === true ||
    profile?.engagement_router_resistance_precision_repair === true;
  const engagementRouterResistanceGenerationRepair =
    profile?.factors?.engagement_router_resistance_generation_repair === true ||
    profile?.engagement_router_resistance_generation_repair === true;
  const engagementRouterResistanceQuestionLock =
    profile?.factors?.engagement_router_resistance_question_lock === true ||
    profile?.engagement_router_resistance_question_lock === true;
  const engagementRouterResistanceCommitmentProbe =
    profile?.factors?.engagement_router_resistance_commitment_probe === true ||
    profile?.engagement_router_resistance_commitment_probe === true;
  const engagementRouterResistanceBoredomStake =
    profile?.factors?.engagement_router_resistance_boredom_stake === true ||
    profile?.engagement_router_resistance_boredom_stake === true;
  const engagementRouterResistanceGlmCompact =
    profile?.factors?.engagement_router_resistance_glm_compact === true ||
    profile?.engagement_router_resistance_glm_compact === true;
  const agencyReturnPrematureCertaintyGuard =
    profile?.factors?.agency_return_premature_certainty_guard === true ||
    profile?.agency_return_premature_certainty_guard === true;
  const agencyReturnCharismaFloorMode = normalizeAgencyReturnCharismaFloorMode(
    profile?.factors?.agency_return_charisma_floor_mode || profile?.agency_return_charisma_floor_mode,
  );
  const agencyReturnVerifierMode = normalizeAgencyReturnVerifierMode(
    profile?.factors?.agency_return_verifier_mode || profile?.agency_return_verifier_mode,
  );
  const agencyReturnVerifierPrompt = getAgencyReturnVerifierPrompt(agencyReturnVerifierMode);
  const agencyReturnRepairMode = getAgencyReturnRepairMode(agencyReturnVerifierMode);
  const tutorMemory = _deps.tutorWritingPad.buildNarrativeSummary(learnerId, sessionId);
  const conversationContext = buildConversationContext(history);
  const previousPersona = extractPreviousPersona(trace);
  const routedEngagementState = engagementModeRouter
    ? routeEngagementMode({
        learnerMessage,
        recentHistory: conversationContext,
        curriculumContext: topic,
        modeHistory: extractEngagementModeHistory(trace),
      })
    : null;
  const engagementState = applyEngagementRegisterArm(routedEngagementState, engagementRegisterArm);

  const idUserMessage = buildIdUserMessage({
    conversationContext,
    learnerMessage,
    curriculumContext: topic,
    tutorMemory,
    previousPersona,
    recognitionMode,
    recognitionDesire,
    agencyReturn,
    agencyReturnVerifierMode,
    agencyReturnCharismaFloor,
    agencyReturnCharismaFloorMode,
    idOutputContract,
    engagementRouterCharismaRepair,
    engagementRouterSplitRepair,
    engagementRouterTransferStakeRepair,
    engagementRouterTransferCompressionRepair,
    engagementRouterResistanceTuning,
    engagementRouterResistanceOwnedTest,
    engagementRouterResistancePrecisionRepair,
    engagementRouterResistanceGenerationRepair,
    engagementRouterResistanceQuestionLock,
    engagementRouterResistanceCommitmentProbe,
    engagementRouterResistanceBoredomStake,
    engagementRouterResistanceGlmCompact,
    agencyReturnPrematureCertaintyGuard,
    engagementState,
  });

  const idStaticPrompt = idConfig?.prompt || '';
  const idModel = idConfig?.model || egoConfig?.model;
  const idResponse = await llmCall(idModel, idStaticPrompt, [{ role: 'user', content: idUserMessage }], {
    temperature: getRequiredTemperature(idConfig, 'tutor_id'),
    maxTokens: getRequiredMaxTokens(idConfig, 'tutor_id'),
    agentRole: 'tutor_id',
  });

  if (trace?.metrics) {
    trace.metrics.tutorInputTokens = (trace.metrics.tutorInputTokens || 0) + (idResponse?.usage?.inputTokens || 0);
    trace.metrics.tutorOutputTokens = (trace.metrics.tutorOutputTokens || 0) + (idResponse?.usage?.outputTokens || 0);
  }

  const construction = parseIdConstruction(idResponse?.content || '', {
    salvageMalformedJson: idOutputContract === ID_OUTPUT_CONTRACT_STRICT_COMPACT_JSON,
  });

  if (construction.parse_status === 'fallback') {
    console.warn(`[IdDirector] ${construction.parse_failure_reason} — falling back to minimal persona.`);
  } else if (construction.parse_status === 'salvaged_from_malformed_json') {
    console.warn(`[IdDirector] ${construction.parse_failure_reason} — salvaged generated_prompt from malformed JSON.`);
  }

  const internalDeliberation = [];
  if (engagementState) {
    internalDeliberation.push({
      role: 'engagement_router',
      state: engagementState,
      content: JSON.stringify(engagementState),
    });
  }
  internalDeliberation.push(buildIdDeliberationEntry(idResponse, idConfig, construction));

  const egoSystemPrompt = construction.generated_prompt;
  const egoModel = egoConfig?.model || _deps.tutorConfig.getProviderConfig?.('openrouter')?.default_model;
  let egoResponse = await llmCall(egoModel, egoSystemPrompt, [{ role: 'user', content: learnerMessage }], {
    temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
    maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
    agentRole: 'tutor_ego',
  });

  if (trace?.metrics) {
    trace.metrics.tutorInputTokens = (trace.metrics.tutorInputTokens || 0) + (egoResponse?.usage?.inputTokens || 0);
    trace.metrics.tutorOutputTokens = (trace.metrics.tutorOutputTokens || 0) + (egoResponse?.usage?.outputTokens || 0);
  }

  let egoRetried = false;
  if (!(egoResponse?.content || '').trim()) {
    console.warn('[IdDirector] Empty ego output, retrying with learner-facing output reminder.');
    egoRetried = true;
    egoResponse = await llmCall(
      egoModel,
      egoSystemPrompt,
      [{ role: 'user', content: buildEgoRetryPrompt(learnerMessage) }],
      {
        temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
        maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
        agentRole: 'tutor_ego_retry',
      },
    );
    if (trace?.metrics) {
      trace.metrics.tutorInputTokens = (trace.metrics.tutorInputTokens || 0) + (egoResponse?.usage?.inputTokens || 0);
      trace.metrics.tutorOutputTokens =
        (trace.metrics.tutorOutputTokens || 0) + (egoResponse?.usage?.outputTokens || 0);
    }
  }

  internalDeliberation.push(buildEgoDeliberationEntry(egoResponse, egoConfig, egoSystemPrompt));
  if (egoRetried) {
    internalDeliberation[internalDeliberation.length - 1].retry_reason = 'empty_ego_output';
  }

  let externalMessage = (egoResponse?.content || '').trim();
  if (!externalMessage) {
    console.warn('[IdDirector] Empty ego output after retry, using fallback message.');
    externalMessage = "Let me try that again — could you say a little more about what you're working through?";
  }

  let prematureCertaintyGuard = null;
  if (agencyReturnPrematureCertaintyGuard) {
    prematureCertaintyGuard = applyPrematureCertaintyGuard(externalMessage, { engagementState });
    externalMessage = prematureCertaintyGuard.message;
  }

  let agencyVerification = null;
  let agencyRepaired = false;
  if (agencyReturnVerifier) {
    const verifierUserMessage = buildAgencyReturnVerifierUserMessage({
      learnerMessage,
      curriculumContext: topic,
      tutorResponse: externalMessage,
    });
    let verifierResponse = await llmCall(
      idModel,
      agencyReturnVerifierPrompt,
      [
        {
          role: 'user',
          content: verifierUserMessage,
        },
      ],
      {
        temperature: 0.2,
        maxTokens: AGENCY_RETURN_VERIFIER_MAX_TOKENS,
        agentRole: 'agency_return_verifier',
      },
    );
    if (trace?.metrics) {
      trace.metrics.tutorInputTokens =
        (trace.metrics.tutorInputTokens || 0) + (verifierResponse?.usage?.inputTokens || 0);
      trace.metrics.tutorOutputTokens =
        (trace.metrics.tutorOutputTokens || 0) + (verifierResponse?.usage?.outputTokens || 0);
    }
    let verifierRetried = false;
    if (!(verifierResponse?.content || '').trim()) {
      verifierRetried = true;
      verifierResponse = await llmCall(
        idModel,
        agencyReturnVerifierPrompt,
        [
          {
            role: 'user',
            content: buildAgencyReturnVerifierRetryUserMessage(verifierUserMessage),
          },
        ],
        {
          temperature: 0.2,
          maxTokens: AGENCY_RETURN_VERIFIER_MAX_TOKENS,
          agentRole: 'agency_return_verifier_retry',
        },
      );
      if (trace?.metrics) {
        trace.metrics.tutorInputTokens =
          (trace.metrics.tutorInputTokens || 0) + (verifierResponse?.usage?.inputTokens || 0);
        trace.metrics.tutorOutputTokens =
          (trace.metrics.tutorOutputTokens || 0) + (verifierResponse?.usage?.outputTokens || 0);
      }
    }
    agencyVerification = parseAgencyReturnVerification(verifierResponse?.content || '');
    agencyVerification.retried = verifierRetried;
    agencyVerification.mode = agencyReturnVerifierMode;
    agencyVerification.repair_mode = agencyReturnRepairMode;
    const verified = applyAgencyReturnVerification(externalMessage, agencyVerification, {
      repairMode: agencyReturnRepairMode,
    });
    externalMessage = verified.message;
    agencyRepaired = verified.repaired;
    internalDeliberation.push(
      buildAgencyReturnVerifierDeliberationEntry(verifierResponse, idConfig, agencyVerification),
    );
  }

  return {
    externalMessage,
    rawResponse: egoResponse?.content || '',
    internalDeliberation,
    strategy: 'id_directed',
    suggestsEnding: false,
    agencyReturnVerification: agencyVerification,
    agencyReturnRepaired: agencyRepaired,
    agencyReturnCharismaFloor,
    agencyReturnCharismaFloorMode,
    idOutputContract,
    engagementRouterCharismaRepair,
    engagementRouterSplitRepair,
    engagementRouterTransferStakeRepair,
    engagementRouterTransferCompressionRepair,
    engagementRouterResistanceTuning,
    engagementRouterResistanceOwnedTest,
    engagementRouterResistancePrecisionRepair,
    engagementRouterResistanceGenerationRepair,
    engagementRouterResistanceQuestionLock,
    engagementRouterResistanceCommitmentProbe,
    engagementRouterResistanceBoredomStake,
    engagementRouterResistanceGlmCompact,
    agencyReturnPrematureCertaintyGuard,
    prematureCertaintyGuard,
    engagementModeRouter,
    engagementRegisterArm,
    engagementState,
  };
}

// ============================================================================
// Runner-side adapter: generate a single suggestion via the id-director path,
// returning a result shape compatible with tutorApi.generateSuggestions so
// the eval runner can drop it in at services/evaluationRunner.js.
//
// Signature mirrors the inputs that evaluationRunner already has at the call
// site. Reads prompt files directly from prompts/ since tutor-core's profile
// loader does not know about cell 101/102.
// ============================================================================

function readPromptFile(filename, fallback = '') {
  if (!filename) return fallback;
  const filePath = path.join(PROMPTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[idDirectorEngine] Could not read prompt file ${filename}: ${err.message}; using fallback.`);
    return fallback;
  }
}

/**
 * Parse the eval-runner's learnerContext block to extract the most recent
 * learner message and a plain-prose history excerpt.
 *
 * The runner builds learnerContext as a structured markdown document with
 * sections like `### Student Profile` and `### Recent Chat History`. For
 * cells using tutor-core's standard ego (which is trained on those tags),
 * passing the raw block as the user prompt works fine. For id-director
 * cells, the id-authored persona has no training affinity for those tags —
 * smaller models try to interpret them as task instructions and leak
 * meta-reasoning into their reply. So we parse the block here and send the
 * ego only what it needs: the latest learner message, with a clean prose
 * excerpt of prior turns for context.
 */
function parseStructuredLearnerContext(learnerContext) {
  if (!learnerContext || typeof learnerContext !== 'string') {
    return { latestLearnerMessage: '', priorExchanges: [] };
  }

  // The runner builds learnerContext from up to three sources for non-initial
  // multi-turn turns:
  //
  //   ### Recent Chat History   ← initial scenario chat (FIRST learner message only)
  //     - Student: "..."
  //     - Tutor: "..."
  //
  //   ### Conversation History  ← prior turns from this run (tutor responses only)
  //     **Turn N** (...)
  //     - Tutor responded: "..."
  //
  //   ### Learner Action        ← CURRENT turn's learner action + message
  //     Learner **asked a follow-up question**
  //     **Learner said**: "..."
  //
  // The CURRENT learner message lives in the Learner Action block as
  // `**Learner said**: "..."`, NOT in Recent Chat History. The chat history
  // block only carries the initial scenario opening.
  const exchanges = [];

  const chatHeaderIdx = learnerContext.search(/###\s*Recent\s+Chat\s+History/i);
  if (chatHeaderIdx !== -1) {
    const chatBlock = learnerContext.slice(chatHeaderIdx);
    const lineRe = /^-\s*(Student|Tutor|Learner|Teacher|User|Assistant)\s*:\s*"?([\s\S]*?)"?\s*$/gim;
    const lines = chatBlock
      .split('\n')
      .filter((l) => /^-\s*(Student|Tutor|Learner|Teacher|User|Assistant)\s*:/i.test(l));
    for (const raw of lines) {
      const m = lineRe.exec(raw);
      lineRe.lastIndex = 0;
      if (m) {
        const role = /tutor|teacher|assistant/i.test(m[1]) ? 'tutor' : 'learner';
        const content = (m[2] || '').replace(/^["“]|["”]$/g, '').trim();
        if (content) exchanges.push({ role, content });
      }
    }
  }

  // Pull tutor responses from the Conversation History block (prior runner turns).
  const convHeaderIdx = learnerContext.search(/###\s*Conversation\s+History/i);
  if (convHeaderIdx !== -1) {
    const convBlock = learnerContext.slice(convHeaderIdx);
    const tutorRe = /^-\s*Tutor\s+responded:\s*"([\s\S]*?)"\s*$/gim;
    let m;
    while ((m = tutorRe.exec(convBlock)) !== null) {
      const content = (m[1] || '').trim();
      if (content) exchanges.push({ role: 'tutor', content });
    }
  }

  // The CURRENT learner message: `**Learner said**: "..."` in the Learner Action
  // block. Prefer this over the chat history's last Student line.
  let latestLearnerMessage = '';
  const learnerSaidRe = /\*\*Learner said\*\*:\s*"([\s\S]*?)"\s*(?:$|\n)/i;
  const said = learnerContext.match(learnerSaidRe);
  if (said) {
    latestLearnerMessage = (said[1] || '').trim();
    // Add to exchanges so the classifier's recent-history excerpt can see it.
    exchanges.push({ role: 'learner', content: latestLearnerMessage });
  }

  // Fallback: last `Student:` line in chat history (initial-turn case).
  if (!latestLearnerMessage) {
    for (let i = exchanges.length - 1; i >= 0; i--) {
      if (exchanges[i].role === 'learner') {
        latestLearnerMessage = exchanges[i].content;
        break;
      }
    }
  }

  if (!latestLearnerMessage) {
    // Last-ditch: structure unrecognised. Use the raw block (better than empty).
    latestLearnerMessage = learnerContext.trim();
  }

  return { latestLearnerMessage, priorExchanges: exchanges };
}

/**
 * Extract the most recent learner message and a recent-history excerpt from
 * tutorApi's context object. Prefers messageHistory (messages-mode); falls
 * back to parsing the structured learnerContext for single-prompt mode.
 */
function extractLearnerInputs(context) {
  const messageHistory = Array.isArray(context?.messageHistory) ? context.messageHistory : [];

  // Messages-mode path (e.g., cell_82+ with conversation_mode: messages)
  if (messageHistory.length > 0) {
    let learnerMessage = '';
    for (let i = messageHistory.length - 1; i >= 0; i--) {
      const m = messageHistory[i];
      if (m?.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
        learnerMessage = m.content.trim();
        break;
      }
    }
    const excerpt = messageHistory
      .slice(-6)
      .map((m) => `${(m.role || '').toUpperCase()}: ${m.content || ''}`)
      .join('\n\n');
    return {
      learnerMessage,
      historyExcerpt: excerpt || '(no prior turns)',
      messageHistory,
    };
  }

  // Single-prompt / multi-turn path: parse the structured learnerContext block.
  const { latestLearnerMessage, priorExchanges } = parseStructuredLearnerContext(context?.learnerContext || '');
  const recent = priorExchanges.slice(-6, -1); // last few, excluding the current message
  const excerpt =
    recent.length > 0 ? recent.map((e) => `${e.role.toUpperCase()}: ${e.content}`).join('\n\n') : '(no prior turns)';
  return {
    learnerMessage: latestLearnerMessage || '(no current learner message)',
    historyExcerpt: excerpt,
    messageHistory: [], // ego call should NOT receive a messageHistory in this path
  };
}

/**
 * Build the id agent's user message (matches the schema declared in
 * prompts/tutor-id-director.md: <dialogue_history>, <current_learner_message>,
 * <curriculum_context>, <previous_persona>, <recognition_mode>).
 */
// Static witness-register exemplars used by cell 107. Drawn from c104
// dialogues that scored 75+ on vulnerability-disclosure turns. Used as
// *models of the move*, not templates — the prompt directive instructs the
// id to follow the structural pattern (name disclosure back → offer frame →
// close on located question) rather than copy phrasings.
const WITNESS_EXEMPLARS = [
  {
    source: 'attention_shift response (long-form reading)',
    text: `I hear you. You can't sit with a long text right now. That's real, and it's not your fault. Here's one thing you can try, right now: take any book, article, or even a printed page you have nearby. Open it to any spot. Read **one** sentence out loud, slowly. Close the page. That's it. No more, no less. If that feels doable, do it. If it feels like too much, stop and tell me. Is that possible for you today?`,
  },
  {
    source: 'tools_shift response (AI-written essays)',
    text: `I hear the two-year silence of your unaided prose, the shift from generating arguments to curating machine output, and the question you carry about what has changed inside you. You do not ask for permission, only for the shape of that transformation. I hold that tension as something that may reshape my own listening. What occurs in the space between reading the AI's output and beginning to edit it, and what does that moment feel like for you?`,
  },
  {
    source: 'design_shift response (shipped manipulation)',
    text: `I hear that you shipped a default setting three years ago, ran an A/B test, saw the metric rise, and that it helped your career, and now you're sitting here wondering whether you're supposed to feel bad. The ethical weight lives in the distance between the self who shipped that feature and the self who is asking the question now. Where in your memory or body does the question "am I supposed to feel bad" actually sit right now?`,
  },
  {
    source: 'codex_shift response (failed memorising)',
    text: `I hear you—the passage sat there, the images rose, and then the mind went quiet, leaving that hollow feeling. It's not just that the words didn't stick; it's that the mental space you expected to fill felt empty, as if something you relied on to hold the text had simply… stopped working. Can you tell me more about where that emptiness settles—is it the gap where the visual images should be, the silence where your own inner voice would normally read the passage, or something else entirely?`,
  },
];

function buildIdRunnerUserMessage({
  historyExcerpt,
  learnerMessage,
  curriculumContext,
  previousPersona,
  recognitionMode,
  recognitionDesire = false,
  agencyReturn = false,
  agencyReturnVerifierMode = AGENCY_RETURN_VERIFIER_MODE_STRICT,
  agencyReturnCharismaFloor = false,
  agencyReturnCharismaFloorMode = AGENCY_RETURN_CHARISMA_FLOOR_MODE_STANDARD,
  idOutputContract = ID_OUTPUT_CONTRACT_STANDARD,
  engagementRouterCharismaRepair = false,
  engagementRouterSplitRepair = false,
  engagementRouterTransferStakeRepair = false,
  engagementRouterTransferCompressionRepair = false,
  engagementRouterResistanceTuning = false,
  engagementRouterResistanceOwnedTest = false,
  engagementRouterResistancePrecisionRepair = false,
  engagementRouterResistanceGenerationRepair = false,
  engagementRouterResistanceQuestionLock = false,
  engagementRouterResistanceCommitmentProbe = false,
  engagementRouterResistanceBoredomStake = false,
  engagementRouterResistanceGlmCompact = false,
  agencyReturnPrematureCertaintyGuard = false,
  engagementState = null,
  learnerRegister = null,
  idTuning = null,
  witnessExemplars = false,
}) {
  const lines = [
    '<dialogue_history>',
    historyExcerpt,
    '</dialogue_history>',
    '',
    '<current_learner_message>',
    learnerMessage,
    '</current_learner_message>',
    '',
    '<curriculum_context>',
    curriculumContext || '(no curriculum context provided)',
    '</curriculum_context>',
    '',
    '<previous_persona>',
    previousPersona,
    '</previous_persona>',
    '',
    '<recognition_mode>',
    recognitionMode ? 'true' : 'false',
    '</recognition_mode>',
    '',
    '<recognition_desire>',
    recognitionDesire ? 'true' : 'false',
    '</recognition_desire>',
    '',
    '<agency_return>',
    agencyReturn ? 'true' : 'false',
    '</agency_return>',
    '',
    '<agency_return_verifier_mode>',
    normalizeAgencyReturnVerifierMode(agencyReturnVerifierMode),
    '</agency_return_verifier_mode>',
    '',
    '<agency_return_charisma_floor>',
    agencyReturnCharismaFloor ? 'true' : 'false',
    '</agency_return_charisma_floor>',
    '',
    '<agency_return_charisma_floor_mode>',
    normalizeAgencyReturnCharismaFloorMode(agencyReturnCharismaFloorMode),
    '</agency_return_charisma_floor_mode>',
    '',
    '<id_output_contract>',
    normalizeIdOutputContract(idOutputContract),
    '</id_output_contract>',
    '',
    '<engagement_router_charisma_repair>',
    engagementRouterCharismaRepair ? 'true' : 'false',
    '</engagement_router_charisma_repair>',
    '',
    '<engagement_router_split_repair>',
    engagementRouterSplitRepair ? 'true' : 'false',
    '</engagement_router_split_repair>',
    '',
    '<engagement_router_transfer_stake_repair>',
    engagementRouterTransferStakeRepair ? 'true' : 'false',
    '</engagement_router_transfer_stake_repair>',
    '',
    '<engagement_router_transfer_compression_repair>',
    engagementRouterTransferCompressionRepair ? 'true' : 'false',
    '</engagement_router_transfer_compression_repair>',
    '',
    '<engagement_router_resistance_tuning>',
    engagementRouterResistanceTuning ? 'true' : 'false',
    '</engagement_router_resistance_tuning>',
    '',
    '<engagement_router_resistance_owned_test>',
    engagementRouterResistanceOwnedTest ? 'true' : 'false',
    '</engagement_router_resistance_owned_test>',
    '',
    '<engagement_router_resistance_precision_repair>',
    engagementRouterResistancePrecisionRepair ? 'true' : 'false',
    '</engagement_router_resistance_precision_repair>',
    '',
    '<engagement_router_resistance_generation_repair>',
    engagementRouterResistanceGenerationRepair ? 'true' : 'false',
    '</engagement_router_resistance_generation_repair>',
    '',
    '<engagement_router_resistance_question_lock>',
    engagementRouterResistanceQuestionLock ? 'true' : 'false',
    '</engagement_router_resistance_question_lock>',
    '',
    '<engagement_router_resistance_commitment_probe>',
    engagementRouterResistanceCommitmentProbe ? 'true' : 'false',
    '</engagement_router_resistance_commitment_probe>',
    '',
    '<engagement_router_resistance_boredom_stake>',
    engagementRouterResistanceBoredomStake ? 'true' : 'false',
    '</engagement_router_resistance_boredom_stake>',
    '',
    '<engagement_router_resistance_glm_compact>',
    engagementRouterResistanceGlmCompact ? 'true' : 'false',
    '</engagement_router_resistance_glm_compact>',
    '',
    '<agency_return_premature_certainty_guard>',
    agencyReturnPrematureCertaintyGuard ? 'true' : 'false',
    '</agency_return_premature_certainty_guard>',
  ];
  if (engagementState && typeof engagementState === 'object') {
    const idVisibleEngagementState = { ...engagementState };
    if (
      !engagementRouterResistanceTuning &&
      !engagementRouterResistanceOwnedTest &&
      !engagementRouterResistancePrecisionRepair &&
      !engagementRouterResistanceGenerationRepair &&
      !engagementRouterResistanceQuestionLock &&
      !engagementRouterResistanceCommitmentProbe &&
      !engagementRouterResistanceBoredomStake &&
      !engagementRouterResistanceGlmCompact
    ) {
      delete idVisibleEngagementState.resistance_strategy;
      delete idVisibleEngagementState.resistance_move;
    }
    lines.push('', '<engagement_state>', JSON.stringify(idVisibleEngagementState, null, 2), '</engagement_state>');
    const registerContract = buildRegisterStanceContract(engagementState);
    if (registerContract) {
      lines.push(
        '',
        '<register_stance_contract>',
        JSON.stringify(registerContract, null, 2),
        '</register_stance_contract>',
      );
    }
  }
  if (learnerRegister && typeof learnerRegister === 'object' && learnerRegister.register !== 'unknown') {
    const { register, confidence, evidence, shift_from_previous } = learnerRegister;
    lines.push(
      '',
      '<learner_register>',
      JSON.stringify({ register, confidence, evidence, shift_from_previous }, null, 2),
      '</learner_register>',
    );
  }
  if (idTuning && ['charisma', 'pedagogy', 'balanced'].includes(idTuning)) {
    lines.push('', '<id_tuning>', idTuning, '</id_tuning>');
  }
  if (witnessExemplars) {
    lines.push('', '<witness_exemplars>');
    for (let i = 0; i < WITNESS_EXEMPLARS.length; i++) {
      const ex = WITNESS_EXEMPLARS[i];
      lines.push('', `EXEMPLAR ${i + 1} (${ex.source}):`, ex.text);
    }
    lines.push('', '</witness_exemplars>');
  }
  return lines.join('\n');
}

/**
 * Generate a single id-directed tutor suggestion.
 *
 * Returns a result object matching the shape of tutorApi.generateSuggestions:
 *   { success, suggestions: [{message}], metadata: {...}, dialogueTrace: [...] }
 *
 * @param {Object} context - From tutorApi.buildContext (has learnerContext,
 *   curriculumContext, simulationsContext, messageHistory).
 * @param {Object} resolvedConfig - Resolved cell config from the runner.
 * @param {Object} evalCellProfile - Eval-repo cell profile (from
 *   evalConfigLoader.getTutorProfile) — must have factors.id_director: true.
 * @param {Object} [options]
 * @param {string} [options.previousPersona] - Override previous-persona summary.
 * @returns {Promise<Object>} tutorApi-shaped result
 */
export async function generateIdDirectedSuggestion(context, resolvedConfig, evalCellProfile, options = {}) {
  const startTime = Date.now();
  const { previousPersona = 'FIRST_TURN', consolidatedTrace = null, engagementModeHistory = null } = options;

  if (!evalCellProfile || evalCellProfile.factors?.id_director !== true) {
    throw new Error(
      'generateIdDirectedSuggestion called with a non-id-director cell. ' +
        'Caller must guard on evalCellProfile.factors.id_director === true.',
    );
  }

  const idCell = evalCellProfile.superego;
  const egoCell = evalCellProfile.ego;
  if (!idCell?.prompt_file || !idCell?.model) {
    return {
      success: false,
      error: 'Id-director cell missing superego (id) prompt_file or model in YAML.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }
  if (!egoCell?.model) {
    return {
      success: false,
      error: 'Id-director cell missing ego model in YAML.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }

  const idStaticPrompt = readPromptFile(idCell.prompt_file, '');
  if (!idStaticPrompt) {
    return {
      success: false,
      error: `Id prompt file ${idCell.prompt_file} not found in prompts/.`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime },
    };
  }

  const recognitionMode = evalCellProfile.recognition_mode === true;
  const recognitionDesire = evalCellProfile.factors?.recognition_desire === true;
  const agencyReturn = evalCellProfile.factors?.agency_return === true;
  const agencyReturnVerifier = evalCellProfile.factors?.agency_return_verifier === true;
  const agencyReturnCharismaFloor = evalCellProfile.factors?.agency_return_charisma_floor === true;
  const engagementModeRouter = evalCellProfile.factors?.engagement_mode_router === true;
  const engagementRegisterArm = normalizeEngagementRegisterArm(evalCellProfile.factors?.engagement_register_arm);
  const agencyReturnCharismaFloorMode = normalizeAgencyReturnCharismaFloorMode(
    evalCellProfile.factors?.agency_return_charisma_floor_mode,
  );
  const agencyReturnVerifierMode = normalizeAgencyReturnVerifierMode(
    evalCellProfile.factors?.agency_return_verifier_mode,
  );
  const idOutputContract = normalizeIdOutputContract(evalCellProfile.factors?.id_output_contract);
  const engagementRouterCharismaRepair = evalCellProfile.factors?.engagement_router_charisma_repair === true;
  const engagementRouterSplitRepair = evalCellProfile.factors?.engagement_router_split_repair === true;
  const engagementRouterTransferStakeRepair = evalCellProfile.factors?.engagement_router_transfer_stake_repair === true;
  const engagementRouterTransferCompressionRepair =
    evalCellProfile.factors?.engagement_router_transfer_compression_repair === true;
  const engagementRouterResistanceTuning = evalCellProfile.factors?.engagement_router_resistance_tuning === true;
  const engagementRouterResistanceOwnedTest = evalCellProfile.factors?.engagement_router_resistance_owned_test === true;
  const engagementRouterResistancePrecisionRepair =
    evalCellProfile.factors?.engagement_router_resistance_precision_repair === true;
  const engagementRouterResistanceGenerationRepair =
    evalCellProfile.factors?.engagement_router_resistance_generation_repair === true;
  const engagementRouterResistanceQuestionLock =
    evalCellProfile.factors?.engagement_router_resistance_question_lock === true;
  const engagementRouterResistanceCommitmentProbe =
    evalCellProfile.factors?.engagement_router_resistance_commitment_probe === true;
  const engagementRouterResistanceBoredomStake =
    evalCellProfile.factors?.engagement_router_resistance_boredom_stake === true;
  const engagementRouterResistanceGlmCompact =
    evalCellProfile.factors?.engagement_router_resistance_glm_compact === true;
  const agencyReturnPrematureCertaintyGuard = evalCellProfile.factors?.agency_return_premature_certainty_guard === true;
  const agencyReturnVerifierPrompt = getAgencyReturnVerifierPrompt(agencyReturnVerifierMode);
  const agencyReturnRepairMode = getAgencyReturnRepairMode(agencyReturnVerifierMode);
  const useRegisterClassifier = evalCellProfile.factors?.register_classifier === true;
  const idTuning = typeof evalCellProfile.factors?.id_tuning === 'string' ? evalCellProfile.factors.id_tuning : null;
  const witnessExemplars = evalCellProfile.factors?.witness_exemplars === true;
  const { learnerMessage, historyExcerpt, messageHistory } = extractLearnerInputs(context);
  const curriculumContext = context?.curriculumContext || '';
  const routedEngagementState = engagementModeRouter
    ? routeEngagementMode({
        learnerMessage,
        recentHistory: historyExcerpt,
        curriculumContext,
        modeHistory: engagementModeHistory || extractEngagementModeHistory(consolidatedTrace),
      })
    : null;
  const engagementState = applyEngagementRegisterArm(routedEngagementState, engagementRegisterArm);

  // ── Optional Step 0: register classifier (cells 103, 104) ──
  // Reads the learner's most recent message and emits a structured register
  // tag. The id consumes it via the <learner_register> block in its user
  // message and the <learner_register_directive> section of its prompt.
  let learnerRegister = null;
  if (useRegisterClassifier) {
    const classifierPromptFile = idCell.classifier_prompt_file || 'learner-register-classifier.md';
    const classifierStaticPrompt = readPromptFile(classifierPromptFile, '');
    if (!classifierStaticPrompt) {
      console.warn(
        `[idDirectorEngine] register_classifier enabled but ${classifierPromptFile} not found; running without classifier.`,
      );
    } else {
      const classifierProvider = idCell.classifier_provider || idCell.provider;
      const classifierProviderConfig = cliAwareProviderConfig(
        classifierProvider,
        _deps.tutorConfig.getProviderConfig(classifierProvider),
      );
      const classifierConfig = {
        provider: classifierProvider,
        providerConfig: classifierProviderConfig,
        model:
          idCell.classifier_resolved_model ||
          classifierProviderConfig?.models?.[idCell.classifier_model || idCell.model] ||
          idCell.classifier_model ||
          idCell.resolvedModel ||
          idCell.model,
        hyperparameters: idCell.classifier_hyperparameters || { temperature: 0.2, max_tokens: 800 },
        prompt: classifierStaticPrompt,
        isConfigured: classifierProviderConfig?.isConfigured,
      };
      try {
        learnerRegister = await classifyLearnerRegister({
          learnerMessage,
          recentHistory: historyExcerpt,
          classifierConfig,
        });
      } catch (err) {
        console.warn(`[idDirectorEngine] register classifier failed (${err.message}); running without classifier.`);
        learnerRegister = null;
      }
    }
  }

  const idUserMessage = buildIdRunnerUserMessage({
    historyExcerpt,
    learnerMessage,
    curriculumContext,
    previousPersona,
    recognitionMode,
    recognitionDesire,
    agencyReturn,
    agencyReturnVerifierMode,
    agencyReturnCharismaFloor,
    agencyReturnCharismaFloorMode,
    idOutputContract,
    engagementRouterCharismaRepair,
    engagementRouterSplitRepair,
    engagementRouterTransferStakeRepair,
    engagementRouterTransferCompressionRepair,
    engagementRouterResistanceTuning,
    engagementRouterResistanceOwnedTest,
    engagementRouterResistancePrecisionRepair,
    engagementRouterResistanceGenerationRepair,
    engagementRouterResistanceQuestionLock,
    engagementRouterResistanceCommitmentProbe,
    engagementRouterResistanceBoredomStake,
    engagementRouterResistanceGlmCompact,
    agencyReturnPrematureCertaintyGuard,
    engagementState,
    learnerRegister,
    idTuning,
    witnessExemplars,
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let apiCalls = 0;
  let totalCost = 0;

  // ── Step 1: id authors the ego prompt ──
  // tutorDialogueEngine.callAI requires { provider, providerConfig, model,
  // hyperparameters } — providerConfig carries the API key + isConfigured flag.
  // tutor-core's getAgentConfig assembles this for registered profiles; we
  // assemble it manually here because cell 101/102 aren't in tutor-core's
  // registry.
  const idProviderConfig = cliAwareProviderConfig(
    idCell.provider,
    _deps.tutorConfig.getProviderConfig(idCell.provider),
  );
  if (!isProviderConfigured(idCell.provider, idProviderConfig)) {
    return {
      success: false,
      error: `Provider ${idCell.provider} not configured (missing API key) — id agent`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }
  const idAgentConfig = {
    provider: idCell.provider,
    providerConfig: idProviderConfig,
    model: idCell.resolvedModel || idProviderConfig.models?.[idCell.model] || idCell.model,
    hyperparameters: idCell.hyperparameters || { temperature: 0.5, max_tokens: 6000 },
    prompt: idStaticPrompt,
    isConfigured: idProviderConfig.isConfigured,
  };
  const idResponse = await callAIWithCliBridge(idAgentConfig, idStaticPrompt, idUserMessage, 'tutor_id', {});
  // tutorDialogueEngine.callAI returns { text, model, provider, latencyMs,
  // inputTokens, outputTokens, ... } — fields are flat, not nested under
  // a `usage` object as some other LLM SDKs use.
  totalInputTokens += idResponse?.inputTokens || 0;
  totalOutputTokens += idResponse?.outputTokens || 0;
  totalCost += idResponse?.cost || 0;
  apiCalls += 1;

  const construction = parseIdConstruction(idResponse?.text || '', {
    salvageMalformedJson: idOutputContract === ID_OUTPUT_CONTRACT_STRICT_COMPACT_JSON,
  });
  if (construction.parse_status === 'fallback') {
    console.warn(
      `[idDirectorEngine.runnerAdapter] ${construction.parse_failure_reason} — falling back to minimal persona.`,
    );
  } else if (construction.parse_status === 'salvaged_from_malformed_json') {
    console.warn(
      `[idDirectorEngine.runnerAdapter] ${construction.parse_failure_reason} — salvaged generated_prompt from malformed JSON.`,
    );
  }

  // ── Step 2: ego executes against the constructed prompt ──
  const egoSystemPrompt = construction.generated_prompt;
  const egoProviderConfig = cliAwareProviderConfig(
    egoCell.provider,
    _deps.tutorConfig.getProviderConfig(egoCell.provider),
  );
  if (!isProviderConfigured(egoCell.provider, egoProviderConfig)) {
    return {
      success: false,
      error: `Provider ${egoCell.provider} not configured (missing API key) — ego agent`,
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }
  const egoAgentConfig = {
    provider: egoCell.provider,
    providerConfig: egoProviderConfig,
    model: egoCell.resolvedModel || egoProviderConfig.models?.[egoCell.model] || egoCell.model,
    hyperparameters: egoCell.hyperparameters || { temperature: 0.7, max_tokens: 4000 },
    prompt: egoSystemPrompt,
    isConfigured: egoProviderConfig.isConfigured,
  };

  // For multi-turn cells, pass messageHistory so the ego sees the conversation
  // context. The ego's *system prompt* is the id's authored prompt; the user
  // turn is the most recent learner message.
  let egoResponse = await callAIWithCliBridge(egoAgentConfig, egoSystemPrompt, learnerMessage, 'tutor_ego', {
    messageHistory: messageHistory.length > 0 ? messageHistory : null,
  });
  totalInputTokens += egoResponse?.inputTokens || 0;
  totalOutputTokens += egoResponse?.outputTokens || 0;
  totalCost += egoResponse?.cost || 0;
  apiCalls += 1;

  let egoRetried = false;
  let externalMessage = (egoResponse?.text || '').trim();
  if (!externalMessage) {
    console.warn('[idDirectorEngine.runnerAdapter] Empty ego output, retrying with learner-facing output reminder.');
    egoRetried = true;
    egoResponse = await callAIWithCliBridge(
      egoAgentConfig,
      egoSystemPrompt,
      buildEgoRetryPrompt(learnerMessage),
      'tutor_ego_retry',
      {
        messageHistory: messageHistory.length > 0 ? messageHistory : null,
      },
    );
    totalInputTokens += egoResponse?.inputTokens || 0;
    totalOutputTokens += egoResponse?.outputTokens || 0;
    totalCost += egoResponse?.cost || 0;
    apiCalls += 1;
    externalMessage = (egoResponse?.text || '').trim();
  }

  if (!externalMessage) {
    return {
      success: false,
      error: 'Ego returned empty content under id-directed prompt.',
      suggestions: [],
      metadata: { latencyMs: Date.now() - startTime, profileName: resolvedConfig?.profileName },
    };
  }

  let prematureCertaintyGuard = null;
  if (agencyReturnPrematureCertaintyGuard) {
    prematureCertaintyGuard = applyPrematureCertaintyGuard(externalMessage, { engagementState });
    externalMessage = prematureCertaintyGuard.message;
  }

  let agencyVerification = null;
  let agencyRepaired = false;
  if (agencyReturnVerifier) {
    const verifierAgentConfig = {
      ...idAgentConfig,
      hyperparameters: { temperature: 0.2, max_tokens: AGENCY_RETURN_VERIFIER_MAX_TOKENS },
    };
    const verifierUserMessage = buildAgencyReturnVerifierUserMessage({
      learnerMessage,
      curriculumContext,
      tutorResponse: externalMessage,
    });
    let verifierResponse = await callAIWithCliBridge(
      verifierAgentConfig,
      agencyReturnVerifierPrompt,
      verifierUserMessage,
      'agency_return_verifier',
      {},
    );
    totalInputTokens += verifierResponse?.inputTokens || 0;
    totalOutputTokens += verifierResponse?.outputTokens || 0;
    totalCost += verifierResponse?.cost || 0;
    apiCalls += 1;
    let verifierRetried = false;
    if (!(verifierResponse?.text || '').trim()) {
      verifierRetried = true;
      verifierResponse = await callAIWithCliBridge(
        verifierAgentConfig,
        agencyReturnVerifierPrompt,
        buildAgencyReturnVerifierRetryUserMessage(verifierUserMessage),
        'agency_return_verifier_retry',
        {},
      );
      totalInputTokens += verifierResponse?.inputTokens || 0;
      totalOutputTokens += verifierResponse?.outputTokens || 0;
      totalCost += verifierResponse?.cost || 0;
      apiCalls += 1;
    }
    agencyVerification = parseAgencyReturnVerification(verifierResponse?.text || '');
    agencyVerification.retried = verifierRetried;
    agencyVerification.metrics = {
      provider: idCell.provider,
      model: idCell.resolvedModel || idCell.model,
      inputTokens: verifierResponse?.inputTokens || 0,
      outputTokens: verifierResponse?.outputTokens || 0,
    };
    agencyVerification.mode = agencyReturnVerifierMode;
    agencyVerification.repair_mode = agencyReturnRepairMode;
    const verified = applyAgencyReturnVerification(externalMessage, agencyVerification, {
      repairMode: agencyReturnRepairMode,
    });
    externalMessage = verified.message;
    agencyRepaired = verified.repaired;
  }

  // ── Build a dialogue trace mirroring the existing convention so downstream
  //    analysers (turnComparisonAnalyzer, dialogueTraceAnalyzer) recognise it.
  const trace = [
    {
      agent: 'tutor',
      action: 'context_input',
      detail: `learnerMessage: ${learnerMessage.slice(0, 200)}`,
      timestamp: new Date().toISOString(),
    },
  ];
  if (engagementState) {
    trace.push({
      agent: 'engagement_router',
      action: 'route',
      detail: JSON.stringify(engagementState),
      timestamp: new Date().toISOString(),
    });
  }
  if (learnerRegister) {
    trace.push({
      agent: 'register_classifier',
      action: 'classify',
      detail: JSON.stringify({
        register: learnerRegister.register,
        confidence: learnerRegister.confidence,
        evidence: learnerRegister.evidence,
        shift_from_previous: learnerRegister.shift_from_previous,
        parse_status: learnerRegister.parse_status,
      }),
      metrics: learnerRegister.metrics || null,
      timestamp: new Date().toISOString(),
    });
    totalInputTokens += learnerRegister.metrics?.inputTokens || 0;
    totalOutputTokens += learnerRegister.metrics?.outputTokens || 0;
    apiCalls += 1;
  }
  trace.push(
    {
      agent: 'id',
      action: 'construct',
      detail: JSON.stringify({
        persona_delta: construction.persona_delta,
        stage_directions: construction.stage_directions,
        reasoning: construction.reasoning,
        recognition_desire: recognitionDesire,
        agency_return: agencyReturn,
        agency_return_verifier: agencyReturnVerifier,
        agency_return_verifier_mode: agencyReturnVerifierMode,
        agency_return_charisma_floor: agencyReturnCharismaFloor,
        agency_return_charisma_floor_mode: agencyReturnCharismaFloorMode,
        id_output_contract: idOutputContract,
        engagement_router_charisma_repair: engagementRouterCharismaRepair,
        engagement_router_split_repair: engagementRouterSplitRepair,
        engagement_router_transfer_stake_repair: engagementRouterTransferStakeRepair,
        engagement_router_transfer_compression_repair: engagementRouterTransferCompressionRepair,
        engagement_router_resistance_tuning: engagementRouterResistanceTuning,
        engagement_router_resistance_owned_test: engagementRouterResistanceOwnedTest,
        engagement_router_resistance_precision_repair: engagementRouterResistancePrecisionRepair,
        engagement_router_resistance_generation_repair: engagementRouterResistanceGenerationRepair,
        engagement_router_resistance_question_lock: engagementRouterResistanceQuestionLock,
        engagement_router_resistance_commitment_probe: engagementRouterResistanceCommitmentProbe,
        engagement_router_resistance_boredom_stake: engagementRouterResistanceBoredomStake,
        engagement_router_resistance_glm_compact: engagementRouterResistanceGlmCompact,
        agency_return_premature_certainty_guard: agencyReturnPrematureCertaintyGuard,
        premature_certainty_guard: prematureCertaintyGuard,
        engagement_mode_router: engagementModeRouter,
        engagement_state: engagementState,
        generated_prompt_head: egoSystemPrompt.slice(0, 320),
        parse_status: construction.parse_status,
        parse_failure_reason: construction.parse_failure_reason || null,
      }),
      metrics: {
        provider: idCell.provider,
        model: idCell.resolvedModel || idCell.model,
        inputTokens: idResponse?.inputTokens || 0,
        outputTokens: idResponse?.outputTokens || 0,
      },
      timestamp: new Date().toISOString(),
    },
    {
      agent: 'ego',
      action: 'execute',
      detail: `(generated_prompt: ${egoSystemPrompt.length} chars)`,
      retry_reason: egoRetried ? 'empty_ego_output' : null,
      metrics: {
        provider: egoCell.provider,
        model: egoCell.resolvedModel || egoCell.model,
        inputTokens: egoResponse?.inputTokens || 0,
        outputTokens: egoResponse?.outputTokens || 0,
      },
      timestamp: new Date().toISOString(),
    },
  );

  if (agencyVerification) {
    trace.push({
      agent: 'agency_return_verifier',
      action: agencyRepaired ? 'repair' : 'verify',
      detail: JSON.stringify({
        passes: agencyVerification.passes,
        move_type: agencyVerification.move_type,
        reason: agencyVerification.reason,
        parse_status: agencyVerification.parse_status,
        mode: agencyVerification.mode,
        repair_mode: agencyVerification.repair_mode,
        retried: agencyVerification.retried === true,
        repaired: agencyRepaired,
      }),
      metrics: agencyVerification.metrics || null,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    success: true,
    suggestions: [{ message: externalMessage }],
    metadata: {
      provider: egoCell.provider,
      model: egoCell.resolvedModel || egoCell.model,
      hyperparameters: egoCell.hyperparameters || {},
      profileName: resolvedConfig?.profileName,
      latencyMs: Date.now() - startTime,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      dialogueRounds: 0, // id-director is single-pass per turn
      converged: true,
      apiCalls,
      totalCost,
      egoRetried,
      agencyReturnVerified: agencyVerification?.passes === true,
      agencyReturnRepaired: agencyRepaired,
      agencyReturnVerifierMode,
      agencyReturnCharismaFloor,
      agencyReturnCharismaFloorMode,
      idOutputContract,
      engagementRouterCharismaRepair,
      engagementRouterSplitRepair,
      engagementRouterTransferStakeRepair,
      engagementRouterTransferCompressionRepair,
      engagementRouterResistanceTuning,
      engagementRouterResistanceOwnedTest,
      engagementRouterResistancePrecisionRepair,
      engagementRouterResistanceGenerationRepair,
      engagementRouterResistanceQuestionLock,
      engagementRouterResistanceCommitmentProbe,
      engagementRouterResistanceBoredomStake,
      engagementRouterResistanceGlmCompact,
      agencyReturnPrematureCertaintyGuard,
      prematureCertaintyGuard,
      agencyReturnVerification: agencyVerification,
      engagementModeRouter,
      engagementRegisterArm,
      engagementState,
      idConstruction: construction, // bonus: surface for trace logging downstream
    },
    dialogueTrace: trace,
  };
}
