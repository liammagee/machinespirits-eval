import { auditTutorStubResponseConfiguration } from './tutorStubResponseConfiguration.js';
import {
  auditTutorStubDueSourceActionAlignment,
  renderTutorStubDueSource,
} from './tutorStubDueSourceRenderer.js';

export const TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft.v1';
export const TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft-composition.v1';
export const TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.structured-first-draft-slot-audit.v1';

const STRUCTURED_KEYS = Object.freeze(['uptake', 'part', 'tactic', 'handoff']);
const HOST_PLAN_BLOCK = /\[Tutor-only host plan\][\s\S]*?\[End tutor-only host plan\]/u;
const SLOT_LABEL_PATTERN = /^(?:uptake|part|source|tactic|handoff)\s*(?::|—|-)/iu;
const NON_UPTAKE_QUOTE_PATTERN = /[“”"]/u;
const SENTENCE_TERMINATOR_PATTERN = /[.!?](?:[”"'’])?$/u;
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

function hostSlots(contract) {
  const slots = Array.isArray(contract?.host_plan?.slots) ? contract.host_plan.slots : [];
  const slotsById = new Map(slots.map((slot) => [slot?.id, slot]));
  const issues = [];
  if (contract?.host_plan?.host_sentence_count !== 4) issues.push('host_sentence_count_must_be_four');
  for (const key of STRUCTURED_KEYS) {
    const slot = slotsById.get(key);
    if (!slot || slot.kind !== 'host' || slot.required !== true || !oneLine(slot.instruction)) {
      issues.push(`missing_host_slot:${key}`);
    }
  }
  if (issues.length) throw new Error(`structured first-draft contract invalid: ${issues.join(', ')}`);
  return slotsById;
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
  const sourceCoverage = shared.length / sourceTokens.size;
  const slotCoverage = shared.length / slotTokens.size;
  return {
    substantial: shared.length >= 3 && (sourceCoverage >= 0.3 || slotCoverage >= 0.45),
    shared,
    sourceCoverage,
    slotCoverage,
  };
}

function structuredCompositionIntegrityIssues(composition, candidate = null) {
  const issues = [];
  if (composition?.schema !== TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA) {
    return [{ type: 'missing_structured_composition', reason: 'slot ownership requires a valid composition' }];
  }
  const text = String(composition.text || '');
  if (candidate !== null && String(candidate) !== text) {
    issues.push({
      type: 'composition_candidate_mismatch',
      reason: 'saved composition text does not exactly equal the candidate audited by whole-response gates',
    });
  }
  const spans = Array.isArray(composition.spans) ? composition.spans : [];
  const sourceCount = spans.filter((span) => span?.kind === 'source').length;
  const expectedIds = [
    'uptake',
    'part',
    ...Array.from({ length: sourceCount }, (_, index) => `source_${index + 1}`),
    'tactic',
    'handoff',
  ];
  if (
    !spans.length ||
    JSON.stringify(spans.map((span) => span?.id)) !== JSON.stringify(expectedIds) ||
    Number(composition.sourceCount) !== sourceCount
  ) {
    issues.push({
      type: 'invalid_span_structure',
      reason: 'composition spans do not have the required ordered host/source structure',
    });
  }
  let expectedStart = 0;
  for (const span of spans) {
    const spanText = typeof span?.text === 'string' ? span.text : '';
    const expectedKind = String(span?.id || '').startsWith('source_') ? 'source' : 'host';
    const validOffsets =
      Number.isInteger(span?.start) &&
      Number.isInteger(span?.end) &&
      span.start === expectedStart &&
      span.end === span.start + spanText.length &&
      text.slice(span.start, span.end) === spanText;
    if (!spanText || span?.kind !== expectedKind || !validOffsets) {
      issues.push({
        type: 'invalid_span_reconstruction',
        span: span?.id || null,
        reason: 'a saved span does not faithfully reconstruct its exact candidate substring',
      });
    }
    if (expectedKind === 'host' && composition.slots?.[span?.id] !== spanText) {
      issues.push({
        type: 'slot_span_mismatch',
        span: span?.id || null,
        reason: 'a saved host span does not exactly equal its parsed slot value',
      });
    }
    expectedStart = Number.isInteger(span?.end) ? span.end + 1 : Number.NaN;
  }
  if (spans.map((span) => span?.text).join(' ') !== text) {
    issues.push({
      type: 'invalid_span_reconstruction',
      span: null,
      reason: 'joining saved spans does not exactly reconstruct the composed candidate',
    });
  }
  const sources = Array.isArray(composition.sources) ? composition.sources : [];
  const sourceSpans = spans.filter((span) => span?.kind === 'source');
  if (sources.length !== sourceSpans.length) {
    issues.push({
      type: 'invalid_source_provenance',
      reason: 'source provenance count does not match source spans',
    });
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

/**
 * Replace prose realization with a strict four-field model boundary. SOURCE is
 * deliberately absent: the host owns due-evidence insertion.
 */
export function tutorStubStructuredFirstDraftPrompt(contract = null) {
  const slots = hostSlots(contract);
  const wordTarget = Number(
    contract?.language?.host_sentence_word_target || contract?.language?.max_average_sentence_words || 24,
  );
  const plainNovice =
    ['adult_novice', 'child'].includes(contract?.language?.audience_register) &&
    ['plain', 'glossed_plain'].includes(contract?.language?.lexical_accessibility);
  return [
    '[Tutor-only structured host plan]',
    'Return exactly one JSON object and nothing else:',
    '{"uptake":"...","part":"...","tactic":"...","handoff":"..."}',
    'Use exactly those four keys in that order. Every value must be one complete public sentence on one line, with terminal punctuation and valid JSON escaping.',
    `Keep each sentence at most ${wordTarget} words. Use one voice, common ${oneLine(contract?.language?.lexical_accessibility) || 'plain'} words, and one relation per sentence.${plainNovice ? ' Gloss the learner’s specialist term in uptake.' : ''}`,
    'Do not copy, paraphrase, introduce, label, or quote SOURCE. The host inserts SOURCE after part. Only uptake may contain quotation marks when its instruction explicitly requires Write: wording.',
    `UPTAKE — ${oneLine(slots.get('uptake').instruction)}`,
    `PART — ${oneLine(slots.get('part').instruction)}`,
    `TACTIC — ${oneLine(slots.get('tactic').instruction)}`,
    oneLine(slots.get('tactic').semantic_instruction)
      ? `TACTIC SEMANTICS — ${oneLine(slots.get('tactic').semantic_instruction)}`
      : null,
    `HANDOFF — ${oneLine(slots.get('handoff').instruction)}`,
    'Never announce roles, strategy, analysis, proof machinery, or hidden/future evidence.',
    '[End tutor-only structured host plan]',
  ]
    .filter(Boolean)
    .join('\n');
}

export function replaceTutorStubFrozenRequestWithStructuredPrompt(bundle = null) {
  if (!bundle?.firstDraftContract) {
    throw new Error('structured frozen request requires firstDraftContract');
  }
  const refreshed = clone(bundle);
  const messages = Array.isArray(refreshed.request?.messages) ? refreshed.request.messages : [];
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') {
    throw new Error('structured frozen request requires a final user message');
  }
  const content = String(latest.content || '');
  const matches = content.match(new RegExp(HOST_PLAN_BLOCK.source, 'gu')) || [];
  if (matches.length !== 1) {
    throw new Error(`structured frozen request requires exactly one host plan block; found ${matches.length}`);
  }
  latest.content = content.replace(
    HOST_PLAN_BLOCK,
    tutorStubStructuredFirstDraftPrompt(refreshed.firstDraftContract),
  );
  refreshed.request.messages = messages;
  refreshed.structuredFirstDraft = {
    schema: TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA,
    enabled: true,
    model_fields: [...STRUCTURED_KEYS],
    source_owner: 'host',
  };
  return refreshed;
}

export function parseTutorStubStructuredFirstDraft(text = '', { maxWordsPerSlot = null } = {}) {
  const raw = String(text || '').trim();
  const wordLimit = Number(maxWordsPerSlot);
  const enforceWordLimit = Number.isFinite(wordLimit) && wordLimit > 0;
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`structured first draft invalid: invalid_json:${error.message}`);
  }
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push('root_must_be_object');
  } else {
    const keys = Object.keys(value);
    if (JSON.stringify(keys) !== JSON.stringify(STRUCTURED_KEYS)) {
      issues.push(`keys_must_be_exact_and_ordered:${keys.join(',') || 'none'}`);
    }
    for (const key of STRUCTURED_KEYS) {
      const slot = value[key];
      if (typeof slot !== 'string') {
        issues.push(`slot_must_be_string:${key}`);
        continue;
      }
      if (slot !== slot.trim()) issues.push(`slot_has_outer_whitespace:${key}`);
      if (!slot.trim()) issues.push(`slot_is_empty:${key}`);
      if (/\r|\n/u.test(slot)) issues.push(`slot_is_multiline:${key}`);
      if (slot && sentenceCount(slot) !== 1) issues.push(`slot_must_be_one_sentence:${key}`);
      if (slot && !SENTENCE_TERMINATOR_PATTERN.test(slot)) issues.push(`slot_needs_terminal_punctuation:${key}`);
      if (slot && enforceWordLimit && wordCount(slot) > wordLimit) {
        issues.push(`slot_exceeds_word_target:${key}:${wordCount(slot)}>${wordLimit}`);
      }
      if (SLOT_LABEL_PATTERN.test(slot)) issues.push(`slot_contains_label:${key}`);
      if (key !== 'uptake' && NON_UPTAKE_QUOTE_PATTERN.test(slot)) {
        issues.push(`quotation_not_allowed:${key}`);
      }
    }
  }
  if (issues.length) throw new Error(`structured first draft invalid: ${issues.join(', ')}`);
  return {
    schema: TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA,
    slots: Object.fromEntries(STRUCTURED_KEYS.map((key) => [key, value[key]])),
  };
}

export function composeTutorStubStructuredFirstDraft({ structured = null, dramaticReleaseFrame = null } = {}) {
  if (structured?.schema !== TUTOR_STUB_STRUCTURED_FIRST_DRAFT_SCHEMA || !structured?.slots) {
    throw new Error('structured composition requires a parsed structured first draft');
  }
  const entries = dramaticReleaseFrame?.active
    ? Array.isArray(dramaticReleaseFrame.entries)
      ? dramaticReleaseFrame.entries
      : []
    : [];
  if (dramaticReleaseFrame?.active && !entries.length) {
    throw new Error('structured source invalid: active_frame_has_no_entries');
  }
  const sources = entries.map(renderTutorStubDueSource);
  for (const { surface } of sources) {
    for (const key of STRUCTURED_KEYS) {
      if (structured.slots[key].includes(surface)) {
        throw new Error(`structured composition invalid: source_copied_into_host_slot:${key}`);
      }
      const overlap = substantialSourceOverlap(structured.slots[key], surface);
      if (overlap.substantial) {
        throw new Error(
          `structured composition invalid: source_content_repeated_in_host_slot:${key}:${overlap.shared.join('|')}`,
        );
      }
    }
  }

  const ordered = [
    { id: 'uptake', kind: 'host', text: structured.slots.uptake },
    { id: 'part', kind: 'host', text: structured.slots.part },
    ...sources.map((source) => ({ id: source.id, kind: 'source', text: source.text })),
    { id: 'tactic', kind: 'host', text: structured.slots.tactic },
    { id: 'handoff', kind: 'host', text: structured.slots.handoff },
  ];
  let text = '';
  const spans = [];
  for (const item of ordered) {
    if (text) text += ' ';
    const start = text.length;
    text += item.text;
    spans.push({ ...item, start, end: text.length });
  }
  for (const { surface } of sources) {
    const count = exactOccurrences(text, surface);
    if (count !== 1) throw new Error(`structured composition invalid: source_occurrence_count:${count}`);
  }
  return {
    schema: TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA,
    text,
    slots: clone(structured.slots),
    spans,
    sources: clone(sources),
    sourceCount: sources.length,
  };
}

export function auditTutorStubStructuredSlotOwnership({
  composition = null,
  candidate = null,
  configuration = null,
  world = null,
  performanceObligationContract = null,
} = {}) {
  const issues = structuredCompositionIntegrityIssues(composition, candidate);
  if (composition?.schema !== TUTOR_STUB_STRUCTURED_COMPOSITION_SCHEMA) {
    return {
      schema: TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA,
      ok: false,
      active: true,
      issues,
      axes: null,
    };
  }
  if (!configuration) {
    return {
      schema: TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA,
      ok: false,
      active: true,
      issues: [{ type: 'missing_response_configuration', reason: 'slot ownership requires a response configuration' }],
      axes: null,
    };
  }
  const spans = new Map(
    (composition.spans || []).filter((span) => span?.kind === 'host').map((span) => [span.id, span]),
  );
  for (const id of ['part', 'tactic', 'handoff']) {
    if (!spans.get(id)?.text) issues.push({ type: `missing_${id}_span`, reason: `composition has no ${id} host span` });
  }
  if (issues.length) {
    return { schema: TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA, ok: false, active: true, issues, axes: null };
  }

  const partAudit = auditTutorStubResponseConfiguration({
    text: spans.get('part').text,
    configuration,
    world,
  });
  const sourceActionAlignment = auditTutorStubDueSourceActionAlignment({
    text: spans.get('part').text,
    sources: composition.sources,
  });
  issues.push(...sourceActionAlignment.issues);
  const tacticAudit = auditTutorStubResponseConfiguration({
    text: spans.get('tactic').text,
    configuration,
    world,
    performanceObligationContract,
    performanceAuditContext: {
      fullComposedPublicText: composition.text,
      verifiedPartVisible: partAudit?.axes?.actorial_part?.part_visible === true,
    },
  });
  const handoffAudit = auditTutorStubResponseConfiguration({
    text: spans.get('handoff').text,
    configuration,
    world,
  });
  const axes = {
    actorial_part: {
      owner: 'part',
      selected: configuration.actorial_part,
      visible: partAudit?.axes?.actorial_part?.part_visible === true,
    },
    actorial_performance: {
      owner: 'tactic',
      selected: configuration.actorial_performance?.id || null,
      visible: tacticAudit?.axes?.actorial_part?.performance_visible === true,
    },
    action_family: {
      owner: 'handoff',
      selected: configuration.action_family,
      visible: handoffAudit?.axes?.action_family?.visible === true,
    },
    engagement_stance: {
      owner: 'handoff',
      selected: configuration.engagement_stance,
      visible: handoffAudit?.axes?.engagement_stance?.visible === true,
    },
    ...(sourceActionAlignment.active
      ? {
          source_action_alignment: {
            owner: 'part',
            selected: true,
            visible: sourceActionAlignment.ok,
          },
        }
      : {}),
  };
  for (const [axis, row] of Object.entries(axes)) {
    if (!row.visible) {
      issues.push({
        type: 'axis_not_realized_in_owner',
        axis,
        owner: row.owner,
        reason: `${axis} is not visible in its ${row.owner} span`,
      });
    }
  }
  return {
    schema: TUTOR_STUB_STRUCTURED_SLOT_AUDIT_SCHEMA,
    ok: issues.length === 0,
    active: true,
    issues,
    axes,
    sourceActionAlignment,
    spanAudits: { part: partAudit, tactic: tacticAudit, handoff: handoffAudit },
  };
}

export function applyTutorStubStructuredSlotOwnershipAudit({
  audit = null,
  composition = null,
  candidate = null,
  configuration = null,
  world = null,
  performanceObligationContract = null,
} = {}) {
  if (!audit) throw new Error('structured slot ownership requires the whole-response audit');
  const slotAudit = auditTutorStubStructuredSlotOwnership({
    composition,
    candidate,
    configuration,
    world,
    performanceObligationContract,
  });
  const clusters = slotAudit.issues.map(
    (issue) => `structuredSlotOwnershipAudit:${issue.type}${issue.axis ? `:${issue.axis}` : ''}`,
  );
  const hardIssues = slotAudit.issues.map((issue) => ({ guard: 'structuredSlotOwnershipAudit', ...issue }));
  return {
    ...audit,
    ok: audit.ok === true && slotAudit.ok,
    failureClusters: [...(audit.failureClusters || []), ...clusters],
    hardFailureClusters: [...(audit.hardFailureClusters || []), ...clusters],
    deliveryDecision: {
      ...(audit.deliveryDecision || {}),
      ok: audit.deliveryDecision?.ok === true && slotAudit.ok,
      hardIssues: [...(audit.deliveryDecision?.hardIssues || []), ...hardIssues],
    },
    audits: { ...(audit.audits || {}), structuredSlotOwnershipAudit: slotAudit },
    performanceAdjudicationEligibility: slotAudit.ok
      ? audit.performanceAdjudicationEligibility
      : {
          eligible: false,
          reason: 'structured_slot_ownership_failed',
          blockingIssues: clusters,
        },
  };
}
