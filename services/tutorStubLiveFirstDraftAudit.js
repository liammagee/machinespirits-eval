import { auditTutorStubDueSourceActionAlignment } from './tutorStubDueSourceRenderer.js';

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
  const spans = occurrenceRows
    .flatMap((row) => row.spans)
    .sort((left, right) => right.start - left.start);
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

/**
 * The plain live speaker has no trustworthy V2 PERFORMANCE ENTRY span. Require
 * each host-rendered SOURCE exactly once, then bind any required carrier to the
 * nearest real host sentence before that SOURCE. This remains an explicit V1
 * text-boundary audit; it does not infer the structured V2 slot layout.
 */
export function auditTutorStubLiveSourceActionAlignmentV1({
  text = '',
  firstDraftContract = null,
} = {}) {
  const responseText = String(text || '');
  const sources = Array.isArray(firstDraftContract?.evidence?.sources)
    ? firstDraftContract.evidence.sources
    : [];
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
      const boundary = nearestPreSourceHostBoundary(
        responseText,
        span.start,
        precedingSourceEnd,
      );
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
  const issues = [...occurrenceIssues, ...boundaryIssues];
  return {
    schema: TUTOR_STUB_LIVE_SOURCE_ACTION_ALIGNMENT_AUDIT_SCHEMA,
    active: sources.length > 0,
    ok: issues.length === 0,
    scope: 'exact_source_occurrence_and_nearest_pre_source_host_boundary',
    slot_ownership_inferred: false,
    expected_source_count: sources.length,
    exact_source_occurrence_passes: occurrenceRows.filter((row) => row.exact_once).length,
    exact_source_occurrence_failures: occurrenceRows.filter((row) => !row.exact_once).length,
    source_occurrences: occurrenceRows,
    pre_source_boundaries: boundaries,
    source_spans_removed: occurrenceRows
      .filter((row) => row.observed_count > 0)
      .map((row) => row.source),
    audited_host_text: hostWithoutExactSources(responseText, occurrenceRows),
    sources: boundaries.flatMap((boundary) => boundary.sources),
    issues,
  };
}
