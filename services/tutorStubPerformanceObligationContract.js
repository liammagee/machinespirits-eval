export const TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA =
  'machinespirits.tutor-stub.performance-obligation-contract.v1';
export const TUTOR_STUB_PERFORMANCE_EVIDENCE_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.performance-evidence-audit.v1';

const PRESSURE_TACTICS = new Set([
  'dramatic_counterpressure',
  'dry_counterexample',
  'adversarial_pressure',
  'exposed_mismatch',
]);

const EVIDENCE_TACTICS = new Set([
  'evidentiary_boundary',
  'rapid_handoff',
  'measured_testimony',
  ...PRESSURE_TACTICS,
]);

const EVIDENTIARY_BOUNDARY_PERFORMANCE = Object.freeze({
  id: 'evidentiary_boundary',
  label: 'evidentiary boundary',
  contract:
    'State the exact support and its limit with concrete boundary words such as only, not yet, or does not establish.',
});

// These are language-level function words, not scenario vocabulary. All
// scenario-bearing anchor terms are compiled from the explicitly public input.
const FUNCTION_WORDS = new Set(
  'a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in into is it its may me might mine my no nor not of on only or our ours she should so than that the their theirs them then there these they this those through to too under up us was we were what when where which who why will with would you your yours'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function publicStrings(value) {
  if (typeof value === 'string') return oneLine(value) ? [oneLine(value)] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return publicStrings(entry);
    if (!entry || typeof entry !== 'object') return [];
    return publicStrings(entry.surface || entry.text || entry.label);
  });
}

function uniqueStrings(values) {
  return [...new Set(values.flatMap(publicStrings).filter(Boolean))];
}

function contentTokens(value) {
  return [
    ...new Set(
      oneLine(value)
        .toLocaleLowerCase('en')
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)
        ?.map((token) => token.replace(/[’]/gu, "'"))
        .filter((token) => token.length >= 2 && !FUNCTION_WORDS.has(token)) || [],
    ),
  ];
}

function sanitizePublicWorld(publicWorld) {
  return {
    title: oneLine(publicWorld?.title) || null,
    setting: oneLine(publicWorld?.setting) || null,
    question: oneLine(publicWorld?.question) || null,
    summary: oneLine(publicWorld?.summary) || null,
    temporal_frame: oneLine(publicWorld?.temporal_frame) || null,
    narrative_diction: oneLine(publicWorld?.narrative_diction) || null,
    ledger_term: oneLine(publicWorld?.ledger_term) || null,
    public_objects: uniqueStrings(publicWorld?.public_objects || []),
  };
}

function sanitizeEvidenceEntries(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({
      surface: oneLine(typeof entry === 'string' ? entry : entry?.surface || entry?.text),
      role: oneLine(typeof entry === 'object' ? entry?.role : '') || null,
      mode: oneLine(typeof entry === 'object' ? entry?.mode : '') || null,
    }))
    .filter((entry) => entry.surface);
}

function sanitizePublicTurn(publicTurn) {
  return {
    learner_move: oneLine(publicTurn?.learner_move || publicTurn?.learner_text) || null,
    pressure_target: oneLine(publicTurn?.pressure_target || publicTurn?.learner_claim) || null,
    public_claims: uniqueStrings(publicTurn?.public_claims || []),
    contrary_evidence: uniqueStrings(publicTurn?.contrary_evidence || []),
    public_evidence: sanitizeEvidenceEntries(publicTurn?.public_evidence),
    due_evidence: sanitizeEvidenceEntries(publicTurn?.due_evidence),
    public_finding: oneLine(publicTurn?.public_finding) || null,
  };
}

function questionShaped(value) {
  const text = oneLine(value);
  if (!text) return true;
  if (text.includes('?')) return true;
  return /^(?:can|could|did|do|does|how|is|may|should|what|when|where|which|who|why|will|would)\b/iu.test(
    text,
  );
}

function exactCounterpressurePair(turn) {
  const targetCandidates = uniqueStrings([
    turn.pressure_target,
    ...[...turn.public_claims].reverse(),
    turn.learner_move,
  ]);
  const targetSpan = targetCandidates.find((surface) => !questionShaped(surface)) || null;
  const contraryEvidenceSpan = uniqueStrings([
    ...turn.contrary_evidence,
    ...turn.due_evidence.map((entry) => entry.surface),
    ...[...turn.public_evidence].reverse().map((entry) => entry.surface),
  ])[0] || null;
  if (!targetSpan || !contraryEvidenceSpan || targetSpan === contraryEvidenceSpan) return null;
  return {
    target_span: targetSpan,
    contrary_evidence_span: contraryEvidenceSpan,
  };
}

function counterpressureFallbackConfiguration(configuration, reason) {
  return {
    ...configuration,
    actorial_performance: { ...EVIDENTIARY_BOUNDARY_PERFORMANCE },
    speaking_transition: {
      schema: 'machinespirits.tutor-stub.speaking-configuration-transition.v1',
      reason,
      requested_tactic: configuration.actorial_performance.id,
      delivered_tactic: EVIDENTIARY_BOUNDARY_PERFORMANCE.id,
      retained_actorial_part: configuration.actorial_part,
    },
  };
}

function sanitizeConfiguration(configuration) {
  return {
    action_family: oneLine(configuration?.action_family) || null,
    engagement_stance: oneLine(configuration?.engagement_stance) || null,
    actorial_part: oneLine(configuration?.actorial_part) || null,
    actorial_part_label: oneLine(configuration?.actorial_part_label) || null,
    actorial_performance: {
      id: oneLine(configuration?.actorial_performance?.id) || null,
      label: oneLine(configuration?.actorial_performance?.label) || null,
      contract: oneLine(configuration?.actorial_performance?.contract) || null,
    },
  };
}

function anchor(id, surfaces) {
  const publicSurfaces = uniqueStrings(surfaces);
  return {
    id,
    surfaces: publicSurfaces,
    content_tokens: [...new Set(publicSurfaces.flatMap(contentTokens))],
  };
}

function obligation({ id, type, description, anchorIds, evidenceRule }) {
  return {
    id,
    type,
    required: true,
    description,
    anchor_ids: anchorIds,
    evidence_rule: evidenceRule,
  };
}

function publicVisibilityIssue(envelopeName, envelope) {
  if (envelope?.visibility === 'public') return null;
  return {
    type: 'unverified_public_input',
    input: envelopeName,
    reason: `${envelopeName} must declare visibility: public before it can enter a speaking-performance contract.`,
  };
}

/**
 * Compile a public-only, compositional account of what the selected actorial
 * part and performance must accomplish. Unknown input fields are deliberately
 * discarded. In particular, no premise ids, formal facts, future releases, or
 * concealed answers can survive into the returned contract.
 */
export function compileTutorStubPerformanceObligationContract({
  responseConfiguration = null,
  publicWorld = null,
  publicTurn = null,
} = {}) {
  const requestedConfiguration = sanitizeConfiguration(responseConfiguration || {});
  const world = sanitizePublicWorld(publicWorld || {});
  const turn = sanitizePublicTurn(publicTurn || {});
  const requestedTactic = requestedConfiguration.actorial_performance.id || 'unadorned_report';
  const pressurePair = PRESSURE_TACTICS.has(requestedTactic) ? exactCounterpressurePair(turn) : null;
  const configuration = PRESSURE_TACTICS.has(requestedTactic) && !pressurePair
    ? counterpressureFallbackConfiguration(
        requestedConfiguration,
        'counterpressure_inapplicable_without_exact_public_target_and_contrary_evidence_pair',
      )
    : requestedConfiguration;
  const tactic = configuration.actorial_performance.id || 'unadorned_report';
  const terminal = configuration.action_family === 'close_inquiry' || configuration.actorial_part === 'foreperson';
  const evidenceSurfaces = pressurePair
    ? [pressurePair.contrary_evidence_span]
    : uniqueStrings([
        ...turn.contrary_evidence,
        ...turn.due_evidence.map((entry) => entry.surface),
        ...turn.public_evidence.map((entry) => entry.surface),
      ]);
  const sceneReferences = uniqueStrings([
    ...world.public_objects,
    world.ledger_term,
    ...evidenceSurfaces,
  ]);
  const pressureSurfaces = pressurePair
    ? [pressurePair.target_span]
    : uniqueStrings([turn.pressure_target, ...turn.public_claims, turn.learner_move]).filter(
        (surface) => !questionShaped(surface),
      );
  const handoffSurfaces = uniqueStrings([
    ...evidenceSurfaces,
    ...pressureSurfaces,
    world.question,
  ]);
  const findingSurfaces = uniqueStrings([turn.public_finding, world.question, ...evidenceSurfaces]);
  const anchors = [
    anchor('pressure_target', pressureSurfaces),
    anchor('contrary_evidence', evidenceSurfaces),
    anchor('scene_reference', sceneReferences),
    anchor('learner_handoff', handoffSurfaces),
    anchor('public_finding', findingSurfaces),
  ];
  const obligations = [];

  if (PRESSURE_TACTICS.has(tactic)) {
    obligations.push(
      obligation({
        id: 'public_pressure_target',
        type: 'public_pressure_target',
        description: 'Make the already-public claim, shortcut, or judgment being tested identifiable.',
        anchorIds: ['pressure_target'],
        evidenceRule: 'public_anchor_overlap',
      }),
      obligation({
        id: 'contrary_evidence',
        type: 'contrary_evidence',
        description: 'Put the public evidence that tests or resists that pressure into the performed reply.',
        anchorIds: ['contrary_evidence'],
        evidenceRule: 'public_anchor_overlap',
      }),
    );
  } else if (EVIDENCE_TACTICS.has(tactic)) {
    obligations.push(
      obligation({
        id: 'public_evidence',
        type: 'public_evidence',
        description: 'Make the currently public or presently due evidence concrete in the performed reply.',
        anchorIds: ['contrary_evidence'],
        evidenceRule: 'public_anchor_overlap',
      }),
    );
  }

  obligations.push(
    obligation({
      id: 'visible_action',
      type: 'visible_action',
      description: `Make the selected ${configuration.actorial_part_label || configuration.actorial_part || 'actorial part'} visible through first-person conduct around a public scene referent.`,
      anchorIds: ['scene_reference', 'pressure_target'],
      evidenceRule: 'first_person_public_anchor',
    }),
  );

  if (terminal) {
    obligations.push(
      obligation({
        id: 'public_finding',
        type: 'public_finding',
        description: 'State the licensed public finding from the public record.',
        anchorIds: ['public_finding'],
        evidenceRule: 'public_anchor_overlap',
      }),
      obligation({
        id: 'terminal_closure',
        type: 'terminal_closure',
        description: 'End the performed reply with a declarative closure rather than another learner demand.',
        anchorIds: ['public_finding'],
        evidenceRule: 'terminal_declarative_public_anchor',
      }),
    );
  } else {
    obligations.push(
      obligation({
        id: 'learner_handoff',
        type: 'learner_handoff',
        description: 'End by returning a concrete public object, claim, or next test to the learner.',
        anchorIds: ['learner_handoff'],
        evidenceRule: 'terminal_handoff_public_anchor',
      }),
    );
  }

  const compileIssues = [
    publicVisibilityIssue('publicWorld', publicWorld),
    publicVisibilityIssue('publicTurn', publicTurn),
  ].filter(Boolean);
  const anchorsById = new Map(anchors.map((entry) => [entry.id, entry]));
  for (const entry of obligations) {
    if (!entry.anchor_ids.some((id) => anchorsById.get(id)?.content_tokens.length)) {
      compileIssues.push({
        type: 'missing_public_anchor',
        obligation_id: entry.id,
        reason: `No declared public surface can ground ${entry.id}.`,
      });
    }
  }

  return {
    schema: TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA,
    version: 1,
    visibility: 'public_only',
    complete: compileIssues.length === 0,
    offset_units: 'utf16_code_units',
    selection: configuration,
    requested_selection: requestedConfiguration,
    tactic_applicability: {
      requested_tactic: requestedTactic,
      applied_tactic: tactic,
      applicable: !PRESSURE_TACTICS.has(requestedTactic) || Boolean(pressurePair),
      reason:
        PRESSURE_TACTICS.has(requestedTactic) && !pressurePair
          ? 'missing_exact_public_counterpressure_pair'
          : null,
    },
    pressure_pair: pressurePair,
    delivery_configuration: configuration,
    public_context: { world, turn },
    anchors,
    obligations,
    compile_issues: compileIssues,
  };
}

/**
 * Render the contract as a compact speaking instruction. The wording stays
 * structural: public surfaces ground the obligations, while the speaker still
 * authors the line. This is intentionally different from the adjudicator
 * prompt below; generation is never told to emit offsets or audit JSON.
 */
export function tutorStubPerformanceObligationContractPrompt(contract = null) {
  if (
    contract?.schema !== TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA ||
    contract?.complete !== true
  ) {
    return '';
  }
  const pair = contract.pressure_pair;
  if (!pair || !PRESSURE_TACTICS.has(contract.selection?.actorial_performance?.id)) return '';
  return [
    'COUNTERPRESSURE PAIR — In this same development beat, put this exact already-public target against this exact public evidence:',
    `TARGET — ${pair.target_span}`,
    `CONTRARY EVIDENCE — ${pair.contrary_evidence_span}`,
    'Make those two surfaces visibly meet in one sentence or adjacent sentences, then continue to the configured handoff. Do not merely explain the clue, sound forceful, or repeat either surface elsewhere.',
  ].join('\n');
}

function spanIssue(type, evidence, reason, extra = {}) {
  return {
    type,
    obligation_id: oneLine(evidence?.obligation_id) || null,
    evidence_index: Number.isInteger(evidence?.evidence_index) ? evidence.evidence_index : null,
    reason,
    ...extra,
  };
}

function terminalTail(candidate, end) {
  return candidate.slice(end).replace(/[\s”"'’]+/gu, '');
}

function anchorTermsFor(obligation, anchorsById) {
  return [
    ...new Set(
      obligation.anchor_ids.flatMap((id) => anchorsById.get(id)?.content_tokens || []),
    ),
  ];
}

function exactOccurrences(candidate, quotation) {
  const starts = [];
  if (!quotation) return starts;
  let cursor = 0;
  while (cursor <= candidate.length - quotation.length) {
    const found = candidate.indexOf(quotation, cursor);
    if (found < 0) break;
    starts.push(found);
    cursor = found + Math.max(1, quotation.length);
  }
  return starts;
}

function relevanceIssues({ candidate, evidence, obligation, anchorsById }) {
  const quotedText = evidence.text;
  const quotedTokens = new Set(contentTokens(quotedText));
  const anchorTerms = anchorTermsFor(obligation, anchorsById);
  const matchedTerms = anchorTerms.filter((token) => quotedTokens.has(token));
  const issues = [];

  if (!matchedTerms.length) {
    issues.push(
      spanIssue(
        'irrelevant_evidence_span',
        evidence,
        `The quotation does not name any declared public anchor for ${obligation.id}.`,
      ),
    );
  }
  if (obligation.evidence_rule === 'first_person_public_anchor' && !/\b(?:I|my|our|we)\b/iu.test(quotedText)) {
    issues.push(
      spanIssue(
        'irrelevant_evidence_span',
        evidence,
        'Visible-action evidence must quote first-person conduct, not narration about a role.',
      ),
    );
  }
  if (obligation.evidence_rule === 'terminal_handoff_public_anchor') {
    const handoffVisible =
      quotedText.trimEnd().endsWith('?') ||
      /\b(?:we|you)\b[^.!?]{0,85}\b(?:ask|check|compare|decide|examine|find|follow|inspect|need|test|trace|weigh)\b|\b(?:next|now)\b[^.!?]{0,65}\b(?:ask|check|compare|examine|inspect|test|trace)\b/iu.test(
        quotedText,
      );
    if (!handoffVisible || terminalTail(candidate, evidence.end)) {
      issues.push(
        spanIssue(
          'irrelevant_evidence_span',
          evidence,
          'Learner-handoff evidence must be a terminal question or concrete next-test direction.',
        ),
      );
    }
  }
  if (obligation.evidence_rule === 'terminal_declarative_public_anchor') {
    if (quotedText.includes('?') || terminalTail(candidate, evidence.end)) {
      issues.push(
        spanIssue(
          'irrelevant_evidence_span',
          evidence,
          'Closure evidence must be a terminal declarative span.',
        ),
      );
    }
  }
  return { issues, matchedTerms };
}

/**
 * Validate evidence selected by a semantic recognizer or reviewer. This
 * function does not infer a performance from prose. It proves only that every
 * required obligation has one tight, exact quotation and
 * that the quotation is grounded in the obligation's declared public anchors.
 */
export function validateTutorStubPerformanceEvidence({ contract, candidate = '', evidence = [] } = {}) {
  const text = String(candidate || '');
  const issues = [];
  const obligationRows = [];
  const evidenceRows = (Array.isArray(evidence) ? evidence : []).map((entry, evidenceIndex) => ({
    ...entry,
    obligation_id: oneLine(entry?.obligation_id),
    text: String(entry?.text ?? ''),
    evidence_index: evidenceIndex,
  }));

  if (contract?.schema !== TUTOR_STUB_PERFORMANCE_OBLIGATION_CONTRACT_SCHEMA) {
    issues.push({ type: 'invalid_contract_schema', reason: 'The evidence validator requires a v1 obligation contract.' });
  }
  if (contract?.complete !== true) {
    issues.push({ type: 'incomplete_contract', reason: 'The obligation contract has unresolved public-input issues.' });
  }
  const obligations = Array.isArray(contract?.obligations) ? contract.obligations : [];
  const obligationsById = new Map(obligations.map((entry) => [entry.id, entry]));
  const anchorsById = new Map((contract?.anchors || []).map((entry) => [entry.id, entry]));
  const validSpans = [];

  for (const row of evidenceRows) {
    const obligation = obligationsById.get(row.obligation_id);
    if (!obligation) {
      issues.push(spanIssue('unknown_obligation', row, 'The evidence names no obligation in this contract.'));
      continue;
    }
    if (!row.text.trim()) {
      issues.push(spanIssue('empty_evidence_span', row, 'Evidence quotations must be non-empty.'));
      continue;
    }
    if (row.text !== row.text.trim()) {
      issues.push(spanIssue('loose_evidence_span', row, 'Evidence quotations must not include boundary whitespace.'));
      continue;
    }
    let start = row.start;
    let end = row.end;
    let offsetRecovered = false;
    const declaredRangeValid =
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end <= text.length &&
      start < end;
    if (!declaredRangeValid || text.slice(start, end) !== row.text) {
      const occurrences = exactOccurrences(text, row.text);
      if (occurrences.length === 1) {
        [start] = occurrences;
        end = start + row.text.length;
        offsetRecovered = true;
      } else {
        issues.push(
          spanIssue(
            occurrences.length > 1 ? 'ambiguous_evidence_span' : 'inexact_evidence_span',
            row,
            occurrences.length > 1
              ? 'The exact quotation occurs more than once, so valid offsets are required.'
              : 'The quotation is not an exact candidate substring.',
          ),
        );
        continue;
      }
    }
    const effectiveRow = { ...row, start, end };
    const relevance = relevanceIssues({ candidate: text, evidence: effectiveRow, obligation, anchorsById });
    issues.push(...relevance.issues);
    validSpans.push({
      obligation_id: row.obligation_id,
      evidence_index: row.evidence_index,
      start,
      end,
      text: row.text,
      offset_recovered: offsetRecovered,
      matched_anchor_terms: relevance.matchedTerms,
      relevant: relevance.issues.length === 0,
    });
  }

  // A performed sentence can legitimately do two jobs at once: for example,
  // “My case is …” is both the advocate's visible action and the pressure
  // target it puts at risk. Preserve overlap as provenance instead of turning
  // compositional prose into four mechanically separate clauses.
  const orderedSpans = [...validSpans].sort((left, right) => left.start - right.start || left.end - right.end);
  const overlaps = [];
  for (let index = 1; index < orderedSpans.length; index += 1) {
    const previous = orderedSpans[index - 1];
    const current = orderedSpans[index];
    if (current.start < previous.end) {
      overlaps.push({
        evidence_index: current.evidence_index,
        overlaps_evidence_index: previous.evidence_index,
      });
    }
  }

  for (const obligation of obligations.filter((entry) => entry.required)) {
    const supplied = evidenceRows.filter((entry) => entry.obligation_id === obligation.id);
    if (!supplied.length) {
      issues.push({
        type: 'missing_required_evidence',
        obligation_id: obligation.id,
        reason: `No exact candidate span was supplied for ${obligation.id}.`,
      });
    } else if (supplied.length > 1) {
      issues.push({
        type: 'duplicate_obligation_evidence',
        obligation_id: obligation.id,
        reason: `More than one span was supplied for ${obligation.id}.`,
      });
    }
    obligationRows.push({
      id: obligation.id,
      type: obligation.type,
      required: obligation.required,
      supplied_span_count: supplied.length,
      accepted: supplied.length === 1 && !issues.some((issue) => issue.obligation_id === obligation.id),
    });
  }

  return {
    schema: TUTOR_STUB_PERFORMANCE_EVIDENCE_AUDIT_SCHEMA,
    version: 1,
    contract_schema: contract?.schema || null,
    offset_units: 'utf16_code_units',
    candidate_length: text.length,
    pass: issues.length === 0,
    obligations: obligationRows,
    evidence: validSpans,
    overlaps,
    issues,
  };
}
