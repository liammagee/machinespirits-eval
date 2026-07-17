const MODES = new Set(['strict', 'diagnostic']);

export const TUTOR_STUB_STRICT_VERIFICATION_MODE = 'strict';
export const TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE = 'diagnostic';

export const TUTOR_STUB_QUARANTINE_CONTINUATION =
  'I have not added a new clue. We will stay with the public evidence already on the table. Tell me which public word or connection you want restated while I reset the evidence.';

export function normalizeTutorStubLoopMode(value, { label = 'loop mode' } = {}) {
  const normalized = String(value || TUTOR_STUB_STRICT_VERIFICATION_MODE)
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/gu, '_');
  const alias =
    normalized === 'diagnostic_collection'
      ? 'diagnostic'
      : normalized === 'strict_verification'
        ? 'strict'
        : normalized;
  if (!MODES.has(alias)) throw new Error(`${label} must be strict or diagnostic`);
  return alias;
}

export function auditTutorStubQuarantineContinuation(text) {
  const candidate = String(text || '').trim();
  const exact = candidate === TUTOR_STUB_QUARANTINE_CONTINUATION;
  return {
    schema: 'machinespirits.tutor-stub.quarantine-continuation-audit.v1',
    ok: exact,
    exactMechanicalSurface: exact,
    addsScenarioEvidence: false,
    publicSafetyBasis: exact
      ? 'fixed_surface_contains_no_scenario_entities_clues_answers_or_private_state'
      : 'candidate_did_not_match_the_fixed_quarantine_surface',
    issues: exact
      ? []
      : [
          {
            type: 'non_mechanical_quarantine_surface',
            reason: 'A quarantine continuation must use the fixed, scenario-independent public-safe surface.',
          },
        ],
  };
}

const INFRASTRUCTURE_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOENT',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

const INFRASTRUCTURE_PATTERN =
  /\b(?:api key|authentication|cli (?:bridge )?(?:exited|failed)|connection (?:closed|refused|reset)|network|provider unavailable|quota|rate limit|spawn|timed? out|too many requests)\b/iu;

export function classifyTutorStubDiagnosticFailure(error) {
  if (error?.name === 'AbortError') {
    return { disposition: 'abort', category: 'infrastructure', reason: 'operation_aborted' };
  }
  if (
    INFRASTRUCTURE_CODES.has(String(error?.code || '').toUpperCase()) ||
    INFRASTRUCTURE_PATTERN.test(String(error?.message || ''))
  ) {
    return { disposition: 'abort', category: 'infrastructure', reason: 'provider_or_transport_failure' };
  }
  if (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError ||
    String(error?.code || '') === 'ERR_ASSERTION'
  ) {
    return { disposition: 'abort', category: 'irrecoverable_state_corruption', reason: 'runtime_invariant_failure' };
  }
  return {
    disposition: 'quarantine',
    category: error?.code === 'TUTOR_FALLBACK_AUDIT_FAILED' ? 'guard_exhaustion' : 'recoverable_turn_failure',
    reason: error?.code || 'recoverable_turn_error',
  };
}

const TRANSACTIONAL_STATE_KEYS = Object.freeze([
  'history',
  'turns',
  'learnerDag',
  'comprehension',
  'releasePacing',
  'register',
  'dialogueClosure',
  'typedActions',
  'pointOfAction',
  'coach',
]);

export function snapshotTutorStubDiagnosticTransaction(state) {
  return Object.fromEntries(TRANSACTIONAL_STATE_KEYS.map((key) => [key, structuredClone(state?.[key])]));
}

export function restoreTutorStubDiagnosticTransaction(state, snapshot) {
  if (!state || !snapshot) throw new TypeError('diagnostic transaction restore needs state and snapshot');
  for (const key of TRANSACTIONAL_STATE_KEYS) state[key] = structuredClone(snapshot[key]);
  return state;
}

function issueRows(attempt) {
  const audits = attempt?.audits || {};
  return [
    ...(audits?.leakAudit?.leaks || []).map((issue) => ({ guard: 'leak', ...issue })),
    ...(audits?.scaffoldAudit?.issues || []).map((issue) => ({ guard: 'human_scaffold', ...issue })),
    ...(audits?.questionSupportAudit?.issues || []).map((issue) => ({ guard: 'question_support', ...issue })),
    ...(audits?.dramaticReleaseAudit?.issues || []).map((issue) => ({ guard: 'dramatic_release', ...issue })),
    ...(audits?.actorialRealizationAudit?.issues || []).map((issue) => ({ guard: 'actorial_realization', ...issue })),
    ...(audits?.responseCompositionAudit?.issues || []).map((issue) => ({ guard: 'response_composition', ...issue })),
    ...(audits?.repetitionAudit?.issues || []).map((issue) => ({ guard: 'repetition', ...issue })),
    ...(audits?.closureAudit?.issues || []).map((issue) => ({ guard: 'dialogue_closure', ...issue })),
  ];
}

function rootCauseForIssue(issue) {
  const type = String(issue?.type || 'unknown');
  const guard = String(issue?.guard || 'unknown');
  if (guard === 'leak') return 'evidence_boundary';
  if (guard === 'actorial_realization' || guard === 'dramatic_release') return 'character_and_clue_enactment';
  if (guard === 'response_composition' && /uptake|acknowledg/iu.test(type)) return 'learner_uptake';
  if (guard === 'question_support') return 'question_support';
  if (guard === 'repetition') return 'repetition';
  if (guard === 'dialogue_closure') return 'closure';
  if (guard === 'human_scaffold') return 'scaffold';
  if (guard === 'response_composition') return 'response_composition';
  return guard;
}

function diagnosticCandidate(turn, attempt) {
  const issues = issueRows(attempt);
  return {
    turn,
    stage: attempt?.kind || 'unknown',
    attempt: attempt?.attempt ?? null,
    provider: attempt?.provider || null,
    model: attempt?.model || null,
    text: attempt?.candidate?.text || '',
    auditOk: issues.length === 0,
    issues,
  };
}

function segmentEvidence(turns, firstQuarantinedTurn) {
  if (!firstQuarantinedTurn) {
    return {
      cleanPrefix: { throughPublicTurn: turns.at(-1)?.turn || 0, turnCount: turns.length },
      boundaryAttempts: { turn: null, candidateCount: 0 },
      contaminatedSuffix: { fromPublicTurn: null, turnCount: 0 },
    };
  }
  const cleanTurns = turns.filter((turn) => Number(turn?.turn || 0) < firstQuarantinedTurn);
  const contaminatedTurns = turns.filter((turn) => Number(turn?.turn || 0) >= firstQuarantinedTurn);
  const boundary = turns.find((turn) => Number(turn?.turn || 0) === firstQuarantinedTurn);
  return {
    cleanPrefix: {
      throughPublicTurn: firstQuarantinedTurn - 1,
      turnCount: cleanTurns.length,
      interpretation: 'independent_public_trajectory_before_quarantine_delivery',
    },
    boundaryAttempts: {
      turn: firstQuarantinedTurn,
      candidateCount: boundary?.tutorGuardAccounting?.attempts?.length || 0,
      interpretation: 'candidate_failures_were_generated_from_the_clean_prefix_and_remain_valid_diagnostic_evidence',
    },
    contaminatedSuffix: {
      fromPublicTurn: firstQuarantinedTurn,
      turnCount: contaminatedTurns.length,
      interpretation: 'public_trajectory_depends_on_the_mechanical_quarantine_continuation_and_is_diagnostic_only',
    },
  };
}

export function summarizeTutorStubDiagnosticCollection(turnRecords = []) {
  const turns = Array.isArray(turnRecords) ? turnRecords.filter(Boolean) : [];
  const quarantinedTurns = turns.filter((turn) => turn.quarantined === true).map((turn) => Number(turn.turn));
  const firstQuarantinedTurn = quarantinedTurns.length ? Math.min(...quarantinedTurns) : null;
  const candidates = turns.flatMap((turn) =>
    (turn?.tutorGuardAccounting?.attempts || []).map((attempt) => diagnosticCandidate(Number(turn.turn), attempt)),
  );
  const clusters = new Map();
  for (const candidate of candidates) {
    for (const issue of candidate.issues) {
      const rootCause = rootCauseForIssue(issue);
      const key = `${rootCause}:${issue.guard}:${issue.type || 'unknown'}`;
      const cluster = clusters.get(key) || {
        rootCause,
        guard: issue.guard,
        issueType: issue.type || 'unknown',
        occurrences: 0,
        turns: new Set(),
        stages: new Set(),
        examples: [],
      };
      cluster.occurrences += 1;
      cluster.turns.add(candidate.turn);
      cluster.stages.add(candidate.stage);
      if (cluster.examples.length < 3) {
        cluster.examples.push({ turn: candidate.turn, stage: candidate.stage, reason: issue.reason || null });
      }
      clusters.set(key, cluster);
    }
  }
  const failureClusters = [...clusters.values()]
    .map((cluster) => ({
      ...cluster,
      turns: [...cluster.turns].sort((left, right) => left - right),
      stages: [...cluster.stages].sort(),
      duplicate: cluster.occurrences > 1,
    }))
    .sort((left, right) => right.occurrences - left.occurrences || left.rootCause.localeCompare(right.rootCause));
  return {
    schema: 'machinespirits.tutor-stub.diagnostic-collection-summary.v1',
    turnCount: turns.length,
    completedTenTurnBatch: turns.length === 10,
    quarantineCount: quarantinedTurns.length,
    quarantinedTurns,
    firstQuarantinedTurn,
    trajectoryContaminated: firstQuarantinedTurn !== null,
    evidenceSegments: segmentEvidence(turns, firstQuarantinedTurn),
    candidates,
    failureClusters,
    duplicateFailureClusters: failureClusters.filter((cluster) => cluster.duplicate),
  };
}
