function literalGuardSpans(text, needle, issue) {
  const source = String(text || '');
  const target = String(needle || '').trim();
  if (!target) return [];
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(escaped, 'giu');
  return [...source.matchAll(pattern)].map((match) => ({
    guard: issue.guard,
    issueType: issue.type || 'unknown',
    reason: issue.reason || null,
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    offsetEncoding: 'utf16_code_units',
    basis: 'literal_audit_match',
  }));
}

function questionGuardSpans(text, issue) {
  const source = String(text || '');
  const rows = [];
  for (const match of source.matchAll(/[^.!?]*\?/gu)) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const surface = raw.trimStart();
    rows.push({
      guard: issue.guard,
      issueType: issue.type || 'unknown',
      reason: issue.reason || null,
      start: match.index + leading,
      end: match.index + raw.length,
      text: surface,
      offsetEncoding: 'utf16_code_units',
      basis: 'question_audit_match',
    });
  }
  return rows;
}

export function projectTutorStubGuardedSpans(text, issues = []) {
  const source = String(text || '');
  const spans = [];
  for (const issue of issues) {
    const needles = [...(issue.matches || []), issue.responseQuestion].filter(Boolean);
    let issueSpans = needles.flatMap((needle) => literalGuardSpans(source, needle, issue));
    if (
      !issueSpans.length &&
      issue.guard === 'dialogue_closure' &&
      ['closure_response_opens_another_turn', 'multiple_closure_questions', 'closure_reopens_proof_work'].includes(
        issue.type,
      )
    ) {
      issueSpans = questionGuardSpans(source, issue);
    }
    if (!issueSpans.length && issue.type === 'missing_explicit_dialogue_close') {
      issueSpans = [
        {
          guard: issue.guard,
          issueType: issue.type,
          reason: issue.reason || null,
          start: source.length,
          end: source.length,
          text: '',
          offsetEncoding: 'utf16_code_units',
          basis: 'required_insertion_at_end',
        },
      ];
    }
    if (!issueSpans.length) {
      issueSpans = [
        {
          guard: issue.guard,
          issueType: issue.type || 'unknown',
          reason: issue.reason || null,
          start: 0,
          end: source.length,
          text: source,
          offsetEncoding: 'utf16_code_units',
          basis: 'whole_candidate_audit_scope',
        },
      ];
    }
    spans.push(...issueSpans);
  }
  const unique = new Map();
  for (const span of spans) {
    const key = [span.guard, span.issueType, span.start, span.end, span.text].join('\u0000');
    if (!unique.has(key)) unique.set(key, span);
  }
  return [...unique.values()].sort(
    (left, right) => left.start - right.start || left.end - right.end || left.guard.localeCompare(right.guard),
  );
}
