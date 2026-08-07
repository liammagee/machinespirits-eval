import { auditTutorStubDueSourceActionAlignment } from './tutorStubDueSourceRenderer.js';
import { auditTutorStubSourceAccessibilityCompensation } from './tutorStubSourceAccessibilityContract.js';

export const TUTOR_STUB_LIVE_SOURCE_ACTION_ALIGNMENT_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.live-source-action-alignment-audit.v1';

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

function exactOccurrenceSpans(source, needle) {
  const target = String(needle || '');
  if (!target) return [];
  const spans = [];
  let from = 0;
  while (from <= source.length - target.length) {
    const start = source.indexOf(target, from);
    if (start < 0) break;
    spans.push({ start, end: start + target.length });
    from = start + target.length;
  }
  return spans;
}

function hostWithoutExactSources(text, occurrenceRows) {
  const spans = occurrenceRows.flatMap((row) => row.spans).sort((left, right) => right.start - left.start);
  let host = text;
  for (const span of spans) host = `${host.slice(0, span.start)} ${host.slice(span.end)}`;
  return host.replace(/\s+/gu, ' ').trim();
}

function nearestPreSourceHostBoundary(text, sourceStart, precedingSourceEnd = 0) {
  const start = Math.max(0, Math.min(Number(precedingSourceEnd) || 0, sourceStart));
  const available = text.slice(start, sourceStart);
  const segments = [...sentenceSegmenter.segment(available)]
    .map((segment) => ({
      relativeStart: segment.index,
      relativeEnd: segment.index + segment.segment.length,
      text: segment.segment,
    }))
    .filter((segment) => /\S/u.test(segment.text));
  const nearest = segments.at(-1);
  if (!nearest) {
    return {
      start: sourceStart,
      end: sourceStart,
      text: '',
    };
  }
  const leadingWhitespace = nearest.text.search(/\S/u);
  const trailingWhitespace = nearest.text.length - nearest.text.trimEnd().length;
  const boundaryStart = start + nearest.relativeStart + Math.max(0, leadingWhitespace);
  const boundaryEnd = start + nearest.relativeEnd - trailingWhitespace;
  return {
    start: boundaryStart,
    end: boundaryEnd,
    text: text.slice(boundaryStart, boundaryEnd).replace(/\s+/gu, ' ').trim(),
  };
}

function firstCompleteSentenceAfterSource(text, sourceEnd) {
  const tail = text.slice(sourceEnd);
  const leadingWhitespace = tail.search(/\S/u);
  if (leadingWhitespace < 0) return null;
  const available = tail.slice(leadingWhitespace);
  const first = [...sentenceSegmenter.segment(available)].find((segment) => /\S/u.test(segment.segment));
  if (!first) return null;
  const trimmed = first.segment.trim();
  if (!trimmed) return null;
  const withinSegment = first.segment.indexOf(trimmed);
  const start = sourceEnd + leadingWhitespace + first.index + withinSegment;
  return {
    start,
    end: start + trimmed.length,
    text: text.slice(start, start + trimmed.length),
  };
}

function sourceAccessibilityAudit({ responseText, firstDraftContract, occurrenceRows }) {
  const contract = firstDraftContract?.evidence?.source_accessibility || null;
  if (!contract) {
    return {
      active: false,
      ok: true,
      visible: true,
      effective_mode: 'direct',
      owner: null,
      issues: [],
      checks: { compensation_required: false },
      spans: { source: null, compensation: null },
    };
  }
  // V28 direct-only accessibility is a structural campaign preflight, not a
  // new live delivery veto. Preserve that behavior exactly. V29's opt-in
  // policy activates the post-SOURCE compensation boundary and hard audit.
  if (contract.policy !== 'direct_or_compensated_v1') {
    return {
      active: false,
      ok: true,
      visible: contract.direct_accessible === true,
      effective_mode: contract.effective_mode || 'direct',
      owner: null,
      policy: contract.policy || 'direct_only',
      issues: [],
      checks: {
        compensation_required: false,
        direct_only_structural_preflight_preserved: true,
      },
      spans: { source: null, compensation: null },
    };
  }
  const expectedSourceId = contract?.compensation?.source_id || contract?.sources?.[0]?.id || null;
  const occurrence =
    occurrenceRows.find((row) => row.source === expectedSourceId && row.exact_once) ||
    occurrenceRows.find((row) => row.exact_once) ||
    null;
  const sourceSpan = occurrence?.spans?.[0] || null;
  const compensationSpan = sourceSpan ? firstCompleteSentenceAfterSource(responseText, sourceSpan.end) : null;
  return auditTutorStubSourceAccessibilityCompensation({
    contract,
    text: responseText,
    owner: 'post_source_sentence',
    sourceSpan,
    compensationSpan,
  });
}

/**
 * The plain live speaker has no trustworthy V2 PERFORMANCE ENTRY span. Require
 * each host-rendered SOURCE exactly once, then bind any required carrier to the
 * nearest real host sentence before that SOURCE. This remains an explicit V1
 * text-boundary audit; it does not infer the structured V2 slot layout.
 */
export function auditTutorStubLiveSourceActionAlignmentV1({ text = '', firstDraftContract = null } = {}) {
  const responseText = String(text || '');
  const sources = Array.isArray(firstDraftContract?.evidence?.sources) ? firstDraftContract.evidence.sources : [];
  const occurrenceRows = sources.map((source, sourceIndex) => {
    const expectedText = String(source?.text || '');
    const spans = exactOccurrenceSpans(responseText, expectedText);
    return {
      source: source?.id || null,
      source_index: sourceIndex,
      expected_text: expectedText,
      expected_count: 1,
      observed_count: spans.length,
      exact_once: spans.length === 1,
      spans,
    };
  });
  const exactSpans = occurrenceRows
    .filter((row) => row.exact_once)
    .map((row) => ({ source: row.source, ...row.spans[0] }))
    .sort((left, right) => left.start - right.start);
  const boundaries = occurrenceRows
    .filter((row) => row.exact_once)
    .map((row) => {
      const span = row.spans[0];
      const precedingSourceEnd = exactSpans
        .filter((candidate) => candidate.end <= span.start)
        .reduce((latest, candidate) => Math.max(latest, candidate.end), 0);
      const boundary = nearestPreSourceHostBoundary(responseText, span.start, precedingSourceEnd);
      const source = sources[row.source_index] || null;
      const alignment = auditTutorStubDueSourceActionAlignment({
        text: boundary.text,
        sources: source ? [source] : [],
      });
      return {
        source: row.source,
        source_start: span.start,
        source_end: span.end,
        boundary_start: boundary.start,
        boundary_end: boundary.end,
        audited_host_text: boundary.text,
        alignment_active: alignment.active,
        alignment_ok: alignment.ok,
        sources: alignment.sources,
        issues: alignment.issues.map((issue) => ({
          ...issue,
          boundary_start: boundary.start,
          boundary_end: boundary.end,
          audited_host_text: boundary.text,
        })),
      };
    });
  const occurrenceIssues = occurrenceRows
    .filter((row) => !row.exact_once)
    .map((row) => ({
      type: 'due_source_exact_occurrence_count',
      source: row.source,
      expected_count: row.expected_count,
      observed_count: row.observed_count,
      reason: 'the live response must contain the exact host-rendered source once',
    }));
  const boundaryIssues = boundaries.flatMap((boundary) => boundary.issues);
  const accessibility = sourceAccessibilityAudit({
    responseText,
    firstDraftContract,
    occurrenceRows,
  });
  const accessibilityIssues = (accessibility.issues || []).map((type) => ({
    type,
    reason: 'the opt-in source accessibility sentence did not satisfy its extractive public contract',
    effective_mode: accessibility.effective_mode,
    owner: accessibility.owner,
  }));
  const issues = [...occurrenceIssues, ...boundaryIssues, ...accessibilityIssues];
  const passingCompensationSpans =
    accessibility.ok && accessibility.effective_mode === 'compensated' && accessibility.spans?.compensation
      ? [
          {
            ...accessibility.spans.compensation,
            source: contractSourceId(firstDraftContract),
            exact: true,
            ok: true,
          },
        ]
      : [];
  return {
    schema: TUTOR_STUB_LIVE_SOURCE_ACTION_ALIGNMENT_AUDIT_SCHEMA,
    active: sources.length > 0,
    ok: issues.length === 0,
    scope: 'exact_source_occurrence_and_nearest_pre_source_host_boundary',
    source_accessibility_scope: 'first_complete_sentence_immediately_after_exact_source',
    slot_ownership_inferred: false,
    expected_source_count: sources.length,
    exact_source_occurrence_passes: occurrenceRows.filter((row) => row.exact_once).length,
    exact_source_occurrence_failures: occurrenceRows.filter((row) => !row.exact_once).length,
    source_occurrences: occurrenceRows,
    pre_source_boundaries: boundaries,
    source_spans_removed: occurrenceRows.filter((row) => row.observed_count > 0).map((row) => row.source),
    audited_host_text: hostWithoutExactSources(responseText, occurrenceRows),
    sources: boundaries.flatMap((boundary) => boundary.sources),
    source_accessibility: accessibility,
    direct_accessible: firstDraftContract?.evidence?.source_accessibility?.direct_accessible ?? true,
    compensation_required: firstDraftContract?.evidence?.source_accessibility?.compensation_required === true,
    compensation_contract_ready:
      firstDraftContract?.evidence?.source_accessibility?.compensation_contract_ready === true,
    compensation_visible: accessibility.visible === true,
    effective_mode: accessibility.effective_mode || 'direct',
    passing_compensation_spans: passingCompensationSpans,
    issues,
  };
}

function contractSourceId(firstDraftContract) {
  const accessibility = firstDraftContract?.evidence?.source_accessibility;
  return accessibility?.compensation?.source_id || accessibility?.sources?.[0]?.id || null;
}

/**
 * Restrict live configuration realization to host-owned language when the
 * opt-in compensation contract is active. Exact SOURCE is public context and
 * the passing compensation sentence improves accessibility; neither owns the
 * selected part, tactic, or stance. Replacing spans with spaces preserves the
 * surrounding sentence boundaries without exposing their tokens to the
 * realization recognizers.
 */
export function tutorStubLiveResponseConfigurationSurface({ text = '', liveSourceActionAlignmentAudit = null } = {}) {
  const responseText = String(text || '');
  if (liveSourceActionAlignmentAudit?.compensation_required !== true) {
    return {
      active: false,
      text: responseText,
      excluded_spans: [],
      reason: 'ordinary_direct_only_behavior_preserved',
    };
  }
  const sourceSpans = (liveSourceActionAlignmentAudit.source_occurrences || [])
    .filter((row) => row?.exact_once === true && row?.spans?.length === 1)
    .map((row) => ({
      ...row.spans[0],
      kind: 'exact_source',
      source: row.source || null,
    }));
  const compensationSpans = (liveSourceActionAlignmentAudit.passing_compensation_spans || [])
    .filter((span) => span?.ok === true && span?.exact === true)
    .map((span) => ({ ...span, kind: 'passing_compensation' }));
  const excludedSpans = [...sourceSpans, ...compensationSpans]
    .filter(
      (span) =>
        Number.isInteger(span.start) &&
        Number.isInteger(span.end) &&
        span.start >= 0 &&
        span.end > span.start &&
        span.end <= responseText.length,
    )
    .sort((left, right) => right.start - left.start);
  let hostText = responseText;
  for (const span of excludedSpans) {
    hostText = `${hostText.slice(0, span.start)}${' '.repeat(span.end - span.start)}${hostText.slice(span.end)}`;
  }
  return {
    active: true,
    text: hostText,
    excluded_spans: excludedSpans.reverse().map((span) => ({
      kind: span.kind,
      source: span.source || null,
      start: span.start,
      end: span.end,
      text: responseText.slice(span.start, span.end),
      offset_encoding: 'utf16_code_units',
    })),
    reason: 'typed_live_host_axes_exclude_exact_source_and_passing_compensation',
  };
}
