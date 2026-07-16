import { getJointPerformanceStanceContract } from './engagementRegisterRegistry.js';
import {
  auditTutorStubCompositePartOwnership,
  compileTutorStubCompositePartOwnership,
  TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA,
} from './tutorStubCompositePartOwnership.js';
import {
  auditTutorStubResponseConfiguration,
  tutorStubResponseConfigurationPrompt,
} from './tutorStubResponseConfiguration.js';
import { tutorStubGuardIssueRows } from './tutorStubGuardDisposition.js';
import { tutorStubGuardDeliveryDecision } from './tutorStubGuardRecovery.js';
import {
  auditTutorStubDueSourceActionAlignment,
  renderTutorStubDueSource,
} from './tutorStubDueSourceRenderer.js';
import {
  auditTutorStubTurnProgression,
  TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
} from './tutorStubTurnProgressionContract.js';

export const TUTOR_STUB_JOINT_PERFORMANCE_HOST_PLAN_SCHEMA =
  'machinespirits.tutor-stub.joint-performance-host-plan.v2';
export const TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft.v2';
export const TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft-composition.v2';
export const TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft-joint-performance-audit.v2';

const TOP_LEVEL_KEYS = Object.freeze(['uptake', 'performance', 'handoff']);
const PERFORMANCE_KEYS = Object.freeze(['entry', 'response']);
const MODEL_SPAN_IDS = Object.freeze(['uptake', 'performance_entry', 'performance_response', 'handoff']);
const HOST_PLAN_BLOCK = /\[Tutor-only host plan\][\s\S]*?\[End tutor-only host plan\]/u;
const RESPONSE_CONFIGURATION_BLOCK =
  /\[Tutor-only response configuration\][\s\S]*?\[End tutor-only response configuration\]/u;
const SLOT_LABEL_PATTERN = /^(?:uptake|performance(?:\s+(?:entry|response))?|entry|response|source|handoff)\s*(?::|—|-)/iu;
const NON_UPTAKE_QUOTE_PATTERN = /[“”"]/u;
const SENTENCE_TERMINATOR_PATTERN = /[.!?](?:[”"'’])?$/u;
const OUTER_HORIZONTAL_WHITESPACE_PATTERN = /^[\p{Zs}\t\f\v]+|[\p{Zs}\t\f\v]+$/gu;
const SOURCE_FINGERPRINT_STOP_WORDS = new Set(
  'about after again also and are because before being book clue could does evidence from had has have into its just ledger more not only other public record source than that the their them then there these they this those through under very was were what when where which while with would your'.split(
    ' ',
  ),
);
const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sentenceCount(value) {
  return [...sentenceSegmenter.segment(value)].filter((segment) => segment.segment.trim()).length;
}

function wordCount(value) {
  return (String(value || '').match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}

function exactOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= text.length - needle.length) {
    const index = text.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function sourceContentTokens(value) {
  return new Set(
    (String(value || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]{2,}/gu) || [])
      .map((token) => token.replace(/[’]/gu, "'").replace(/'s$/u, ''))
      .filter((token) => token.length >= 4 && !SOURCE_FINGERPRINT_STOP_WORDS.has(token)),
  );
}

function substantialSourceOverlap(slotText, surface) {
  const sourceTokens = sourceContentTokens(surface);
  const slotTokens = sourceContentTokens(slotText);
  if (sourceTokens.size < 3 || slotTokens.size < 3) return { substantial: false, shared: [] };
  const shared = [...sourceTokens].filter((token) => slotTokens.has(token));
  return {
    substantial: shared.length >= 3 && (shared.length / sourceTokens.size >= 0.3 || shared.length / slotTokens.size >= 0.45),
    shared,
  };
}

function v1HostSlots(contract) {
  const slots = Array.isArray(contract?.host_plan?.slots) ? contract.host_plan.slots : [];
  const byId = new Map(slots.map((slot) => [slot?.id, slot]));
  const issues = [];
  if (contract?.host_plan?.host_sentence_count !== 4) issues.push('host_sentence_count_must_be_four');
  for (const id of ['uptake', 'part', 'tactic', 'handoff']) {
    const slot = byId.get(id);
    if (!slot || slot.kind !== 'host' || slot.required !== true || !oneLine(slot.instruction)) {
      issues.push(`missing_host_slot:${id}`);
    }
  }
  if (issues.length) throw new Error(`joint performance contract invalid: ${issues.join(', ')}`);
  return byId;
}

function stanceHandoffInstruction(stance) {
  const cues = {
    brisk: 'Keep it short and forward-moving.',
    charismatic: 'Make it a decisive named challenge.',
    precise: 'Make it distinguish one concrete claim.',
    warm: 'Keep it low-pressure and preserve choice.',
  };
  return cues[stance] || `Make it visibly ${oneLine(stance) || 'precise'}.`;
}

function actionOnlyHandoffInstruction(contract, handoffInstruction) {
  const stanceInstruction = stanceHandoffInstruction(contract?.performance?.engagement_stance);
  if (!handoffInstruction.includes(stanceInstruction)) {
    throw new Error('joint performance contract invalid: handoff_stance_instruction_not_found');
  }
  const actionInstruction = oneLine(handoffInstruction.replace(stanceInstruction, ''));
  if (!actionInstruction) throw new Error('joint performance contract invalid: handoff_action_instruction_missing');
  return actionInstruction;
}

function jointPerformanceCompatibility(contract, entryInstruction) {
  const decisions = Array.isArray(contract?.compatibility?.decisions)
    ? [...contract.compatibility.decisions]
    : [];
  const advocateDelegation = decisions.includes(
    'advocate_case_delegates_concrete_test_to_final_handoff',
  );
  if (!advocateDelegation) {
    return {
      decisions,
      entryInstruction,
      performanceResponseInstruction: null,
      handoffDelegatedComplementInstruction: null,
      compositePartOwnership: null,
    };
  }
  const compositePartOwnership = contract?.compatibility?.composite_axis_ownership;
  if (compositePartOwnership?.schema !== TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA) {
    throw new Error('joint performance contract invalid: missing_composite_part_ownership');
  }
  return {
    decisions,
    entryInstruction: `As ${oneLine(contract?.performance?.actorial_part_label) || 'the public advocate'}, without naming the role, ${oneLine(compositePartOwnership.prompt.performance_initiation)}`,
    performanceResponseInstruction: oneLine(compositePartOwnership.prompt.performance_action_boundary),
    handoffDelegatedComplementInstruction: oneLine(
      compositePartOwnership.prompt.handoff_delegated_complement,
    ),
    compositePartOwnership: clone(compositePartOwnership),
  };
}

export function buildTutorStubJointPerformanceHostPlan(contract = null) {
  const slots = v1HostSlots(contract);
  const source = slots.get('source');
  const sharedSceneInvitation = contract?.performance?.tactic === 'shared_scene_invitation';
  const progression = contract?.progression;
  if (
    progression?.schema !== TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA ||
    progression.complete !== true
  ) {
    throw new Error('joint performance contract invalid: missing_turn_progression_contract');
  }
  const compatibility = jointPerformanceCompatibility(contract, oneLine(slots.get('part').instruction));
  const stanceContract = getJointPerformanceStanceContract(contract?.performance?.engagement_stance);
  return {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_HOST_PLAN_SCHEMA,
    host_sentence_count: 4,
    ordered_surface_ids: [
      'uptake',
      'performance_entry',
      ...(source ? ['source'] : []),
      'performance_response',
      'handoff',
    ],
    model_shape: {
      uptake: 'sentence',
      performance: { entry: 'sentence', response: 'sentence' },
      handoff: 'sentence',
    },
    slots: {
      uptake: { instruction: oneLine(slots.get('uptake').instruction) },
      performance: {
        entry_instruction: compatibility.entryInstruction,
        response_instruction: oneLine(slots.get('tactic').instruction),
        compatibility_instruction: compatibility.performanceResponseInstruction,
        stance_instruction: oneLine(stanceContract.contract),
        stance_instruction_source: stanceContract.source,
        semantic_instruction: oneLine(slots.get('tactic').semantic_instruction),
        response_contract: sharedSceneInvitation
          ? progression.handoff_contract?.question_owner === 'performance_response'
            ? {
                type: 'open_learner_owned_question',
                terminal_question: true,
                explicit_learner_or_shared_address: true,
                supplied_or_commanded_reading: false,
              }
            : {
                type: 'declarative_shared_attention',
                terminal_question: false,
                explicit_learner_or_shared_address: true,
                question_owner: progression.handoff_contract?.question_owner || null,
              }
          : null,
        joint_instruction: [
          `Treat entry and response as one ${oneLine(contract?.performance?.actorial_part_label) || 'public part'} performance beat.`,
          `Across them, make the ${oneLine(contract?.performance?.tactic_label) || 'selected tactic'} and ${oneLine(contract?.performance?.engagement_stance) || 'selected'} stance visible.`,
          oneLine(stanceContract.contract),
        ]
          .filter(Boolean)
          .join(' '),
      },
      source: source
        ? { active: true, owner: 'host', placement: 'between_performance_entry_and_response' }
        : { active: false, owner: 'host', placement: 'between_performance_entry_and_response' },
      handoff: {
        instruction: [
          actionOnlyHandoffInstruction(contract, oneLine(slots.get('handoff').instruction)),
          compatibility.handoffDelegatedComplementInstruction,
        ]
          .filter(Boolean)
          .join(' '),
      },
    },
    compatibility: {
      decisions: compatibility.decisions,
      composite_axis_ownership: compatibility.compositePartOwnership,
    },
    progression: clone(progression),
    axis_ownership: {
      audience_register: ['uptake', 'performance', 'handoff'],
      lexical_accessibility: ['uptake', 'performance', 'handoff'],
      scene_immersion: ['performance'],
      actorial_part: ['performance'],
      actorial_performance: ['performance'],
      engagement_stance: ['performance'],
      public_evidence: source ? ['source'] : [],
      action_family: ['handoff'],
    },
    delegated_axis_prerequisites: compatibility.compositePartOwnership
      ? { actorial_part: ['handoff'] }
      : {},
  };
}

export function tutorStubJointPerformanceFirstDraftPrompt(contract = null) {
  const plan = buildTutorStubJointPerformanceHostPlan(contract);
  const wordTarget = Number(
    contract?.language?.host_sentence_word_target || contract?.language?.max_average_sentence_words || 24,
  );
  const draftingWordCeiling = Math.min(wordTarget, Math.max(8, wordTarget - 3));
  const plainNovice =
    ['adult_novice', 'child'].includes(contract?.language?.audience_register) &&
    ['plain', 'glossed_plain'].includes(contract?.language?.lexical_accessibility);
  return [
    '[Tutor-only joint-performance host plan]',
    'Return exactly one JSON object and nothing else:',
    '{"uptake":"...","performance":{"entry":"...","response":"..."},"handoff":"..."}',
    'Use exactly those keys in that order. Every string must be one complete public sentence on one line, with terminal punctuation and valid JSON escaping.',
    `Draft each sentence at most ${draftingWordCeiling} words, leaving room below the hard ${wordTarget}-word limit. Count every sentence’s words before emitting JSON. Use one voice, common ${oneLine(contract?.language?.lexical_accessibility) || 'plain'} words, and one relation per sentence.${plainNovice ? ' Gloss the learner’s specialist term in uptake.' : ''}`,
    'Do not copy, paraphrase, introduce, label, or quote SOURCE. The host inserts SOURCE between performance.entry and performance.response. Only uptake may contain quotation marks when its instruction explicitly requires Write: wording.',
    `UPTAKE — ${plan.slots.uptake.instruction}`,
    `TURN FOCUS — ${plan.progression.turn_focus_contract.instruction}`,
    `PERFORMANCE ENTRY — ${plan.slots.performance.entry_instruction}`,
    `PERFORMANCE RESPONSE — ${plan.slots.performance.response_instruction}`,
    plan.slots.performance.compatibility_instruction
      ? `PERFORMANCE COMPATIBILITY — ${plan.slots.performance.compatibility_instruction}`
      : null,
    plan.slots.performance.semantic_instruction
      ? `PERFORMANCE SEMANTICS — ${plan.slots.performance.semantic_instruction}`
      : null,
    plan.slots.performance.response_contract?.type === 'open_learner_owned_question'
      ? 'PERFORMANCE RESPONSE CONTRACT — Ask one open what/how/which question addressed to the learner or shared inquiry. Do not command a reading or ask for agreement with a supplied reading.'
      : plan.slots.performance.response_contract?.type === 'declarative_shared_attention'
        ? 'PERFORMANCE RESPONSE CONTRACT — Invite shared attention declaratively with you, we, our, or together. Ask no question here; HANDOFF owns the terminal move.'
      : null,
    `JOINT PERFORMANCE — ${plan.slots.performance.joint_instruction}`,
    `HANDOFF ACTION — ${plan.slots.handoff.instruction}`,
    'Never announce roles, strategy, analysis, proof machinery, or hidden/future evidence.',
    '[End tutor-only joint-performance host plan]',
  ]
    .filter(Boolean)
    .join('\n');
}

export function replaceTutorStubFrozenRequestWithJointPerformancePrompt(bundle = null) {
  if (!bundle?.firstDraftContract) {
    throw new Error('joint performance frozen request requires firstDraftContract');
  }
  const refreshed = clone(bundle);
  const messages = Array.isArray(refreshed.request?.messages) ? refreshed.request.messages : [];
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') {
    throw new Error('joint performance frozen request requires a final user message');
  }
  const content = String(latest.content || '');
  const matches = content.match(new RegExp(HOST_PLAN_BLOCK.source, 'gu')) || [];
  if (matches.length !== 1) {
    throw new Error(`joint performance frozen request requires exactly one host plan block; found ${matches.length}`);
  }
  const hostPlan = buildTutorStubJointPerformanceHostPlan(refreshed.firstDraftContract);
  let updatedContent = content.replace(
    HOST_PLAN_BLOCK,
    tutorStubJointPerformanceFirstDraftPrompt(refreshed.firstDraftContract),
  );
  const responseConfigurationMatches = updatedContent.match(
    new RegExp(RESPONSE_CONFIGURATION_BLOCK.source, 'gu'),
  ) || [];
  if (responseConfigurationMatches.length > 1) {
    throw new Error(
      `joint performance frozen request requires at most one response configuration block; found ${responseConfigurationMatches.length}`,
    );
  }
  if (responseConfigurationMatches.length === 1) {
    const configuration =
      refreshed.speakingResponseConfiguration || refreshed.selectedResponseConfiguration;
    if (!configuration) {
      throw new Error('joint performance frozen request cannot rebuild response configuration');
    }
    updatedContent = updatedContent.replace(
      RESPONSE_CONFIGURATION_BLOCK,
      tutorStubResponseConfigurationPrompt(configuration, {
        stanceContractOverride: hostPlan.slots.performance.stance_instruction,
      }),
    );
  }
  latest.content = updatedContent;
  refreshed.request.messages = messages;
  refreshed.jointPerformanceFirstDraft = {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
    enabled: true,
    model_fields: { uptake: 'string', performance: ['entry', 'response'], handoff: 'string' },
    source_owner: 'host',
    source_placement: 'between_performance_entry_and_response',
    host_plan: hostPlan,
  };
  return refreshed;
}

function validateSentence(value, id, { maxWordsPerSlot = null, allowQuotation = false } = {}) {
  const issues = [];
  const wordLimit = Number(maxWordsPerSlot);
  const enforceWordLimit = Number.isFinite(wordLimit) && wordLimit > 0;
  if (typeof value !== 'string') return [`slot_must_be_string:${id}`];
  if (!value.trim()) issues.push(`slot_is_empty:${id}`);
  if (/\r|\n/u.test(value)) issues.push(`slot_is_multiline:${id}`);
  if (value && sentenceCount(value) !== 1) issues.push(`slot_must_be_one_sentence:${id}`);
  if (value && !SENTENCE_TERMINATOR_PATTERN.test(value)) issues.push(`slot_needs_terminal_punctuation:${id}`);
  if (value && enforceWordLimit && wordCount(value) > wordLimit) {
    issues.push(`slot_exceeds_word_target:${id}:${wordCount(value)}>${wordLimit}`);
  }
  if (SLOT_LABEL_PATTERN.test(value)) issues.push(`slot_contains_label:${id}`);
  if (!allowQuotation && NON_UPTAKE_QUOTE_PATTERN.test(value)) issues.push(`quotation_not_allowed:${id}`);
  return issues;
}

function normalizeTransportSlot(value, slot, normalizations) {
  if (typeof value !== 'string') return value;
  const normalized = value.replace(OUTER_HORIZONTAL_WHITESPACE_PATTERN, '');
  const count = value.length - normalized.length;
  if (count > 0) {
    normalizations.push({ slot, type: 'trim_outer_whitespace', count });
  }
  return normalized;
}

export function parseTutorStubJointPerformanceFirstDraft(text = '', { maxWordsPerSlot = null } = {}) {
  const rawOutput = String(text || '');
  const raw = rawOutput.trim();
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`joint performance first draft invalid: invalid_json:${error.message}`);
  }
  const issues = [];
  const transportNormalizations = [];
  let normalized = value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push('root_must_be_object');
  } else {
    const keys = Object.keys(value);
    if (JSON.stringify(keys) !== JSON.stringify(TOP_LEVEL_KEYS)) {
      issues.push(`keys_must_be_exact_and_ordered:${keys.join(',') || 'none'}`);
    }
    if (!value.performance || typeof value.performance !== 'object' || Array.isArray(value.performance)) {
      issues.push('performance_must_be_object');
    } else {
      const performanceKeys = Object.keys(value.performance);
      if (JSON.stringify(performanceKeys) !== JSON.stringify(PERFORMANCE_KEYS)) {
        issues.push(`performance_keys_must_be_exact_and_ordered:${performanceKeys.join(',') || 'none'}`);
      }
    }
    normalized = {
      uptake: normalizeTransportSlot(value.uptake, 'uptake', transportNormalizations),
      performance:
        value.performance && typeof value.performance === 'object' && !Array.isArray(value.performance)
          ? {
              entry: normalizeTransportSlot(
                value.performance.entry,
                'performance.entry',
                transportNormalizations,
              ),
              response: normalizeTransportSlot(
                value.performance.response,
                'performance.response',
                transportNormalizations,
              ),
            }
          : value.performance,
      handoff: normalizeTransportSlot(value.handoff, 'handoff', transportNormalizations),
    };
    issues.push(...validateSentence(normalized.uptake, 'uptake', { maxWordsPerSlot, allowQuotation: true }));
    issues.push(...validateSentence(normalized.performance?.entry, 'performance.entry', { maxWordsPerSlot }));
    issues.push(...validateSentence(normalized.performance?.response, 'performance.response', { maxWordsPerSlot }));
    issues.push(...validateSentence(normalized.handoff, 'handoff', { maxWordsPerSlot }));
  }
  if (issues.length) throw new Error(`joint performance first draft invalid: ${issues.join(', ')}`);
  return {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
    raw: rawOutput,
    transport_normalizations: transportNormalizations,
    slots: {
      uptake: normalized.uptake,
      performance: { entry: normalized.performance.entry, response: normalized.performance.response },
      handoff: normalized.handoff,
    },
  };
}

function modelSlotValues(structured) {
  return {
    uptake: structured.slots.uptake,
    performance_entry: structured.slots.performance.entry,
    performance_response: structured.slots.performance.response,
    handoff: structured.slots.handoff,
  };
}

function jointPerformanceResponseObligation(configuration, response, progressionContract = null) {
  const tactic = configuration?.actorial_performance?.id || null;
  if (tactic !== 'shared_scene_invitation') {
    return { active: false, tactic, ok: true, requirements: [] };
  }
  const text = String(response || '');
  const declarativeSharedAttention = Boolean(
    progressionContract &&
      (progressionContract.handoff_contract?.question_allowed === false ||
        progressionContract.handoff_contract?.question_owner === 'handoff'),
  );
  const terminalQuestion = /\?(?:[”"'’])?$/u.test(text);
  const learnerAddress = /\b(?:you|your|we|our)\b/iu.test(text);
  const oneQuestion = (text.match(/\?/gu) || []).length === 1;
  const openInterrogative = /^(?:what|how|which)\b/iu.test(text.trimStart());
  const requirements = declarativeSharedAttention
    ? [
        { id: 'declarative_shared_attention', ok: !text.includes('?') },
        { id: 'explicit_learner_or_shared_address', ok: learnerAddress },
        { id: 'question_delegated_to_handoff', ok: !text.includes('?') },
      ]
    : [
    { id: 'terminal_direct_question', ok: terminalQuestion && oneQuestion },
    { id: 'explicit_learner_address', ok: learnerAddress },
    { id: 'open_interrogative_not_supplied_agreement', ok: openInterrogative },
    {
      id: 'learner_owned_not_supplied_or_commanded',
      ok: terminalQuestion && oneQuestion && learnerAddress && openInterrogative,
    },
      ];
  return {
    active: true,
    tactic,
    ok: requirements.every((row) => row.ok),
    requirements,
    reason: declarativeSharedAttention
      ? 'shared-scene response must invite attention declaratively because the final handoff owns the only question'
      : 'shared-scene response must be one direct question addressed to the learner, not a supplied or commanded reading',
  };
}

export function composeTutorStubJointPerformanceFirstDraft({ structured = null, dramaticReleaseFrame = null } = {}) {
  if (structured?.schema !== TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA || !structured?.slots) {
    throw new Error('joint performance composition requires a parsed v2 first draft');
  }
  const entries = dramaticReleaseFrame?.active
    ? Array.isArray(dramaticReleaseFrame.entries)
      ? dramaticReleaseFrame.entries
      : []
    : [];
  if (dramaticReleaseFrame?.active && !entries.length) {
    throw new Error('joint performance source invalid: active_frame_has_no_entries');
  }
  const sources = entries.map(renderTutorStubDueSource);
  const modelValues = modelSlotValues(structured);
  for (const source of sources) {
    for (const [id, value] of Object.entries(modelValues)) {
      if (value.includes(source.surface)) {
        throw new Error(`joint performance composition invalid: source_copied_into_model_slot:${id}`);
      }
      const overlap = substantialSourceOverlap(value, source.surface);
      if (overlap.substantial) {
        throw new Error(
          `joint performance composition invalid: source_content_repeated_in_model_slot:${id}:${overlap.shared.join('|')}`,
        );
      }
    }
  }
  const ordered = [
    { id: 'uptake', kind: 'host', owner: 'model', text: modelValues.uptake },
    { id: 'performance_entry', kind: 'host', owner: 'model', text: modelValues.performance_entry },
    ...sources.map((source) => ({ id: source.id, kind: 'source', owner: 'host', text: source.text })),
    { id: 'performance_response', kind: 'host', owner: 'model', text: modelValues.performance_response },
    { id: 'handoff', kind: 'host', owner: 'model', text: modelValues.handoff },
  ];
  let text = '';
  const spans = [];
  for (const item of ordered) {
    if (text) text += ' ';
    const start = text.length;
    text += item.text;
    spans.push({ ...item, start, end: text.length });
  }
  for (const source of sources) {
    const count = exactOccurrences(text, source.surface);
    if (count !== 1) throw new Error(`joint performance composition invalid: source_occurrence_count:${count}`);
  }
  return {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
    text,
    slots: clone(structured.slots),
    spans,
    sources: clone(sources),
    sourceCount: sources.length,
  };
}

function compositionIntegrityIssues(composition, candidate = null) {
  const issues = [];
  if (composition?.schema !== TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA) {
    return [{ type: 'missing_joint_performance_composition', reason: 'joint audit requires a valid v2 composition' }];
  }
  const text = String(composition.text || '');
  if (candidate !== null && String(candidate) !== text) {
    issues.push({
      type: 'composition_candidate_mismatch',
      reason: 'saved composition text does not exactly equal the candidate audited by whole-response gates',
    });
  }
  const spans = Array.isArray(composition.spans) ? composition.spans : [];
  const sourceSpans = spans.filter((span) => span?.kind === 'source');
  const expectedIds = [
    'uptake',
    'performance_entry',
    ...Array.from({ length: sourceSpans.length }, (_, index) => `source_${index + 1}`),
    'performance_response',
    'handoff',
  ];
  if (
    JSON.stringify(spans.map((span) => span?.id)) !== JSON.stringify(expectedIds) ||
    Number(composition.sourceCount) !== sourceSpans.length
  ) {
    issues.push({
      type: 'invalid_span_structure',
      reason: 'composition spans do not have the required joint-performance/source structure',
    });
  }
  const expectedModelValues = composition?.slots
    ? {
        uptake: composition.slots.uptake,
        performance_entry: composition.slots.performance?.entry,
        performance_response: composition.slots.performance?.response,
        handoff: composition.slots.handoff,
      }
    : {};
  let expectedStart = 0;
  for (const span of spans) {
    const spanText = typeof span?.text === 'string' ? span.text : '';
    const source = String(span?.id || '').startsWith('source_');
    const expectedKind = source ? 'source' : 'host';
    const expectedOwner = source ? 'host' : 'model';
    const validOffsets =
      Number.isInteger(span?.start) &&
      Number.isInteger(span?.end) &&
      span.start === expectedStart &&
      span.end === span.start + spanText.length &&
      text.slice(span.start, span.end) === spanText;
    if (!spanText || span?.kind !== expectedKind || span?.owner !== expectedOwner || !validOffsets) {
      issues.push({
        type: 'invalid_span_reconstruction',
        span: span?.id || null,
        reason: 'a saved span does not faithfully reconstruct its exact candidate substring and owner',
      });
    }
    if (!source && expectedModelValues[span?.id] !== spanText) {
      issues.push({
        type: 'slot_span_mismatch',
        span: span?.id || null,
        reason: 'a saved model span does not exactly equal its parsed slot value',
      });
    }
    expectedStart = Number.isInteger(span?.end) ? span.end + 1 : Number.NaN;
  }
  if (spans.map((span) => span?.text).join(' ') !== text) {
    issues.push({ type: 'invalid_span_reconstruction', span: null, reason: 'saved spans do not reconstruct candidate' });
  }
  const sources = Array.isArray(composition.sources) ? composition.sources : [];
  if (sources.length !== sourceSpans.length) {
    issues.push({ type: 'invalid_source_provenance', reason: 'source provenance count does not match source spans' });
  }
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const span = sourceSpans[index];
    if (
      source?.id !== span?.id ||
      source?.text !== span?.text ||
      !source?.surface ||
      exactOccurrences(text, source.surface) !== 1
    ) {
      issues.push({
        type: 'invalid_source_provenance',
        source: source?.id || null,
        reason: 'host source provenance is not bound exactly once to its saved span and candidate',
      });
    }
  }
  return issues;
}

export function auditTutorStubJointPerformanceOwnership({
  composition = null,
  candidate = null,
  configuration = null,
  world = null,
  performanceObligationContract = null,
  progressionContract = null,
} = {}) {
  const issues = compositionIntegrityIssues(composition, candidate);
  if (composition?.schema !== TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA) {
    return { schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA, ok: false, active: true, issues, axes: null };
  }
  if (!configuration) {
    return {
      schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
      ok: false,
      active: true,
      issues: [{ type: 'missing_response_configuration', reason: 'joint audit requires a response configuration' }],
      axes: null,
    };
  }
  const spans = new Map(
    (composition.spans || []).filter((span) => span?.owner === 'model').map((span) => [span.id, span]),
  );
  for (const id of MODEL_SPAN_IDS) {
    if (!spans.get(id)?.text) {
      issues.push({ type: `missing_${id}_span`, reason: `composition has no ${id} model-owned span` });
    }
  }
  if (issues.length) {
    return { schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA, ok: false, active: true, issues, axes: null };
  }
  const performanceText = `${spans.get('performance_entry').text} ${spans.get('performance_response').text}`;
  const preliminaryPerformanceAudit = auditTutorStubResponseConfiguration({
    text: performanceText,
    configuration,
    world,
  });
  const handoffAudit = auditTutorStubResponseConfiguration({
    text: spans.get('handoff').text,
    configuration,
    world,
  });
  const sourceActionAlignment = auditTutorStubDueSourceActionAlignment({
    text: spans.get('performance_entry').text,
    sources: composition.sources,
  });
  issues.push(...sourceActionAlignment.issues);
  const compositePartOwnershipContract = compileTutorStubCompositePartOwnership({
    actorialPart: configuration.actorial_part,
    actorialPartLabel: configuration.actorial_part_label,
    actionFamily: configuration.action_family,
  });
  const compositePartOwnership = auditTutorStubCompositePartOwnership({
    contract: compositePartOwnershipContract,
    composition,
    selectedActionVisible: handoffAudit?.axes?.action_family?.visible === true,
  });
  const compositeInitiationVisible =
    compositePartOwnership.requirements.find((row) => row.id === 'performance_initiation')?.ok === true;
  const performanceAudit = auditTutorStubResponseConfiguration({
    text: performanceText,
    configuration,
    world,
    performanceObligationContract,
    performanceAuditContext: {
      fullComposedPublicText: composition.text,
      verifiedPartVisible:
        preliminaryPerformanceAudit?.axes?.actorial_part?.part_visible === true || compositeInitiationVisible,
      auditedSpanTexts: [spans.get('performance_entry').text, spans.get('performance_response').text],
      excludedSourceSpanIds: (composition.spans || [])
        .filter((span) => span?.owner === 'host')
        .map((span) => span.id),
    },
  });
  const responseObligation = jointPerformanceResponseObligation(
    configuration,
    spans.get('performance_response').text,
    progressionContract,
  );
  const axes = {
    actorial_part: {
      owner: compositePartOwnership.active ? 'composite' : 'performance',
      initiation_owner: 'performance',
      delegated_complement_owner: compositePartOwnership.active ? 'handoff' : null,
      selected: configuration.actorial_part,
      visible: compositePartOwnership.active
        ? compositePartOwnership.ok
        : performanceAudit?.axes?.actorial_part?.part_visible === true,
    },
    actorial_performance: {
      owner: 'performance',
      selected: configuration.actorial_performance?.id || null,
      visible:
        performanceAudit?.axes?.actorial_part?.performance_visible === true && responseObligation.ok,
    },
    engagement_stance: {
      owner: 'performance',
      selected: configuration.engagement_stance,
      visible: performanceAudit?.axes?.engagement_stance?.visible === true,
    },
    scene_immersion: {
      owner: 'performance',
      selected: configuration.scene_immersion,
      visible: performanceAudit?.axes?.scene_immersion?.visible === true,
    },
    action_family: {
      owner: 'handoff',
      selected: configuration.action_family,
      visible: handoffAudit?.axes?.action_family?.visible === true,
    },
    ...(sourceActionAlignment.active
      ? {
          source_action_alignment: {
            owner: 'performance_entry',
            selected: true,
            visible: sourceActionAlignment.ok,
          },
        }
      : {}),
  };
  if (compositePartOwnership.active && !compositePartOwnership.ok) {
    for (const requirement of compositePartOwnership.requirements.filter((row) => !row.ok)) {
      issues.push({
        type: 'composite_part_requirement_failed',
        axis: 'actorial_part',
        owner: requirement.owner,
        requirement: requirement.id,
        reason: requirement.reason,
      });
    }
  }
  if (!responseObligation.ok) {
    issues.push({
      type: 'performance_response_obligation_failed',
      axis: 'actorial_performance',
      owner: 'performance_response',
      reason: responseObligation.reason,
      requirements: responseObligation.requirements,
    });
  }
  for (const [axis, row] of Object.entries(axes)) {
    if (!row.visible) {
      issues.push({
        type: 'axis_not_realized_in_owner',
        axis,
        owner: row.owner,
        reason: `${axis} is not visible in its ${row.owner} span set`,
      });
    }
  }
  return {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
    ok: issues.length === 0,
    active: true,
    issues,
    axes,
    boundaries: {
      performance: ['performance_entry', 'performance_response'],
      excluded_host_source_spans: (composition.spans || [])
        .filter((span) => span?.owner === 'host')
        .map((span) => span.id),
      handoff: ['handoff'],
    },
    responseObligation,
    sourceActionAlignment,
    compositePartOwnership,
    performanceText,
    spanAudits: { performance: performanceAudit, handoff: handoffAudit },
  };
}

function failureClustersFromAudits(audits) {
  return Object.entries(audits || {}).flatMap(([guard, audit]) => {
    if (!audit || audit.ok !== false) return [];
    const issues = audit.leaks || audit.issues || [];
    if (issues.length) return issues.map((issue) => `${guard}:${issue.type || 'failed'}`);
    if (audit.missingPremises?.length) return [`${guard}:missing_due_evidence`];
    return [`${guard}:failed`];
  });
}

function applyDeterministicCompositePartRecognition(audit, compositePartOwnership) {
  const source = clone(audit);
  if (compositePartOwnership?.active !== true || compositePartOwnership.ok !== true) {
    return { audit: source, applied: false, reason: 'composite_part_ownership_not_satisfied' };
  }
  const responseAudit = source?.audits?.responseConfigurationAudit;
  const actorialAudit = source?.audits?.actorialRealizationAudit;
  const issues = Array.isArray(actorialAudit?.issues) ? actorialAudit.issues : [];
  if (!responseAudit?.axes?.actorial_part || issues.length === 0) {
    return { audit: source, applied: false, reason: 'deterministic_part_already_visible' };
  }
  if (
    issues.some((issue) => issue?.type !== 'missing_selected_actorial_part') ||
    responseAudit.axes.actorial_part.performance_visible !== true
  ) {
    return { audit: source, applied: false, reason: 'not_an_isolated_part_recognition_miss' };
  }
  responseAudit.axes.actorial_part.part_visible = true;
  responseAudit.axes.actorial_part.visible = true;
  responseAudit.axes.actorial_part.evaluated_segment = 'typed_composite_performance_and_handoff';
  responseAudit.actorial_realization = {
    ...(responseAudit.actorial_realization || {}),
    ok: true,
    issues: [],
    deterministic_composite_part_ownership: clone(compositePartOwnership),
  };
  const visibleAxisCount = Object.values(responseAudit.axes).filter((axis) => axis.visible === true).length;
  responseAudit.visible_axis_count = visibleAxisCount;
  responseAudit.realization_rate = Number(
    (visibleAxisCount / Math.max(1, responseAudit.axis_count || Object.keys(responseAudit.axes).length)).toFixed(3),
  );
  responseAudit.transcript_visible =
    visibleAxisCount >= 5 && responseAudit.metrics?.fourthWallBreak !== true;
  responseAudit.visible_signature = String(responseAudit.visible_signature || '').replace(
    /\|part:not_visible\|/u,
    `|part:${responseAudit.axes.actorial_part.selected}|`,
  );
  source.audits.responseConfigurationAudit = responseAudit;
  source.audits.actorialRealizationAudit = clone(responseAudit.actorial_realization);
  const issueRows = tutorStubGuardIssueRows(source.audits);
  const deliveryDecision = tutorStubGuardDeliveryDecision(issueRows);
  source.deliveryDecision = deliveryDecision;
  source.ok = deliveryDecision.ok;
  source.failureClusters = failureClustersFromAudits(source.audits);
  source.hardFailureClusters = deliveryDecision.hardIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}`,
  );
  source.advisoryFailureClusters = deliveryDecision.advisoryIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}`,
  );
  source.reportOnlyFailureClusters = deliveryDecision.reportOnlyIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  source.shadowAdvisoryFailureClusters = deliveryDecision.shadow.advisoryIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  source.performanceAdjudicationEligibility = {
    eligible: false,
    reason: 'deterministic_composite_part_ownership_passed',
  };
  source.deterministicCompositePartRecognition = {
    applied: true,
    reason: 'isolated_part_miss_satisfied_by_typed_composite_contract',
  };
  return { audit: source, applied: true, reason: source.deterministicCompositePartRecognition.reason };
}

const JOINT_PERFORMANCE_OWNED_AXES = Object.freeze([
  'actorial_part',
  'actorial_performance',
  'engagement_stance',
  'scene_immersion',
  'action_family',
]);

function applyDeterministicJointPerformanceRecognition(audit, jointAudit) {
  const source = clone(audit);
  const legacyActorialAudit = clone(source?.audits?.actorialRealizationAudit || null);
  const report = {
    schema: 'machinespirits.tutor-stub.deterministic-joint-performance-recognition.v1',
    applied: false,
    reason: null,
    legacyWholeResponseActorialRealizationAudit: legacyActorialAudit,
    jointAuditSchema: jointAudit?.schema || null,
    jointAxes: clone(jointAudit?.axes || null),
  };
  const jointAxesVisible = JOINT_PERFORMANCE_OWNED_AXES.every(
    (axis) => jointAudit?.axes?.[axis]?.visible === true,
  );
  if (jointAudit?.schema !== TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA || jointAudit.ok !== true || !jointAxesVisible) {
    report.reason = 'joint_performance_ownership_not_satisfied';
    return { audit: source, applied: false, reason: report.reason, report };
  }
  const issues = Array.isArray(legacyActorialAudit?.issues) ? legacyActorialAudit.issues : [];
  if (legacyActorialAudit?.ok !== false || issues.length === 0) {
    report.reason = 'legacy_actorial_realization_already_passed';
    return { audit: source, applied: false, reason: report.reason, report };
  }
  if (issues.some((issue) => issue?.type !== 'missing_selected_performance_tactic')) {
    report.reason = 'legacy_actorial_failure_not_an_isolated_tactic_miss';
    return { audit: source, applied: false, reason: report.reason, report };
  }

  const typedOwnershipProof = {
    schema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
    ok: true,
    owned_axes: Object.fromEntries(
      JOINT_PERFORMANCE_OWNED_AXES.map((axis) => [axis, clone(jointAudit.axes[axis])]),
    ),
  };
  source.audits.actorialRealizationAudit = {
    ...(legacyActorialAudit || {}),
    ok: true,
    issues: [],
    deterministic_joint_performance_ownership: typedOwnershipProof,
  };
  const issueRows = tutorStubGuardIssueRows(source.audits);
  const deliveryDecision = tutorStubGuardDeliveryDecision(issueRows);
  source.deliveryDecision = deliveryDecision;
  source.ok = deliveryDecision.ok;
  source.failureClusters = failureClustersFromAudits(source.audits);
  source.hardFailureClusters = deliveryDecision.hardIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}`,
  );
  source.advisoryFailureClusters = deliveryDecision.advisoryIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}`,
  );
  source.reportOnlyFailureClusters = deliveryDecision.reportOnlyIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  source.shadowAdvisoryFailureClusters = deliveryDecision.shadow.advisoryIssues.map(
    (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  source.performanceAdjudicationEligibility = {
    eligible: false,
    reason: 'deterministic_joint_performance_ownership_passed',
  };
  report.applied = true;
  report.reason = 'isolated_tactic_miss_satisfied_by_typed_joint_ownership';
  report.typedOwnershipProof = typedOwnershipProof;
  source.deterministicJointPerformanceRecognition = report;
  return { audit: source, applied: true, reason: report.reason, report };
}

export function applyTutorStubJointPerformanceOwnershipAudit({
  audit = null,
  composition = null,
  candidate = null,
  configuration = null,
  world = null,
  performanceObligationContract = null,
  progressionContract = null,
} = {}) {
  if (!audit) throw new Error('joint performance ownership requires the whole-response audit');
  const jointAudit = auditTutorStubJointPerformanceOwnership({
    composition,
    candidate,
    configuration,
    world,
    performanceObligationContract,
    progressionContract,
  });
  const turnProgressionAudit = progressionContract
    ? auditTutorStubTurnProgression({ contract: progressionContract, composition })
    : {
        schema: 'machinespirits.tutor-stub.turn-progression-audit.v1',
        active: false,
        ok: true,
        issues: [],
        reason: 'legacy_call_without_progression_contract',
      };
  const recognized = applyDeterministicCompositePartRecognition(
    audit,
    jointAudit.compositePartOwnership,
  );
  const jointRecognized = applyDeterministicJointPerformanceRecognition(recognized.audit, jointAudit);
  const baseAudit = jointRecognized.audit;
  const clusters = jointAudit.issues.map(
    (issue) => `jointPerformanceAudit:${issue.type}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  const hardIssues = jointAudit.issues.map((issue) => ({ guard: 'jointPerformanceAudit', ...issue }));
  const progressionClusters = turnProgressionAudit.issues.map(
    (issue) => `turnProgressionAudit:${issue.type}${issue.owner ? `:${Array.isArray(issue.owner) ? issue.owner.join('+') : issue.owner}` : ''}`,
  );
  const progressionHardIssues = turnProgressionAudit.issues.map((issue) => ({
    guard: 'turnProgressionAudit',
    ...issue,
  }));
  return {
    ...baseAudit,
    ok: baseAudit.ok === true && jointAudit.ok && turnProgressionAudit.ok,
    failureClusters: [...(baseAudit.failureClusters || []), ...clusters, ...progressionClusters],
    hardFailureClusters: [...(baseAudit.hardFailureClusters || []), ...clusters, ...progressionClusters],
    deliveryDecision: {
      ...(baseAudit.deliveryDecision || {}),
      ok: baseAudit.deliveryDecision?.ok === true && jointAudit.ok && turnProgressionAudit.ok,
      hardIssues: [
        ...(baseAudit.deliveryDecision?.hardIssues || []),
        ...hardIssues,
        ...progressionHardIssues,
      ],
    },
    audits: {
      ...(baseAudit.audits || {}),
      jointPerformanceAudit: jointAudit,
      turnProgressionAudit,
    },
    deterministicCompositePartRecognition: {
      applied: recognized.applied,
      reason: recognized.reason,
    },
    deterministicJointPerformanceRecognition: jointRecognized.report,
    performanceAdjudicationEligibility: jointAudit.ok && turnProgressionAudit.ok
      ? baseAudit.performanceAdjudicationEligibility
      : {
          eligible: false,
          reason: turnProgressionAudit.ok ? 'joint_performance_ownership_failed' : 'turn_progression_failed',
          blockingIssues: [...clusters, ...progressionClusters],
        },
  };
}
