import { factKey } from '../dramaticDerivation/chainer.js';
import {
  applyTutorStubPublicLearnerRecordUpdate,
  buildTutorStubPublicLearnerAnalysisTurnRecord,
  createTutorStubPublicLearnerRecord,
  tutorStubPublicStagedEvidence,
} from '../tutorStubPublicLearnerAnalysis.js';
import { createTutorStubDagFactDropoutState } from '../tutorStubDagFactDropout.js';

export const ADAPTIVE_STATE_EXACT_OBSERVER_SCHEMA =
  'machinespirits.adaptive-state-exact-public-observer.v2.3';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function publicEvent(envelope) {
  const events = envelope?.current_public_act_envelope?.events || envelope?.events || [];
  if (!Array.isArray(events) || events.length > 1) {
    throw new Error('stateBenchmarkExactObserver: expected at most one current public event');
  }
  return events[0] || null;
}

function exactClassification(kind) {
  const rows = {
    adopt: {
      discourse_move: 'evidence_adoption',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'receptive',
      agency: 'complying',
      conceptual: 3,
      readiness: 3,
    },
    derive: {
      discourse_move: 'inference',
      evidence_use: 'links_evidence_to_rule',
      epistemic_stance: 'grounded',
      agency: 'steering',
      conceptual: 4,
      readiness: 4,
    },
    retract: {
      discourse_move: 'metacognitive_reflection',
      evidence_use: 'revises_from_evidence',
      epistemic_stance: 'reflective',
      agency: 'self_correcting',
      conceptual: 4,
      readiness: 4,
    },
    none: {
      discourse_move: 'question',
      evidence_use: 'none',
      epistemic_stance: 'exploratory',
      agency: 'attempting',
      conceptual: 2,
      readiness: 3,
    },
  };
  const row = rows[kind] || rows.none;
  return {
    turn: {
      request_type: kind === 'none' ? 'stepwise_support_request' : 'off_task_or_mixed',
      discourse_move: row.discourse_move,
      evidence_use: row.evidence_use,
      epistemic_stance: row.epistemic_stance,
      agency: row.agency,
      affect: 'neutral',
      scores: {
        conceptual_engagement: { score: row.conceptual },
        epistemic_readiness: { score: row.readiness },
      },
      pedagogical_need: kind === 'none' ? 'one bounded next step' : 'continue from the exact public record',
    },
  };
}

function premiseIdForFact(world, fact) {
  if (!Array.isArray(fact)) return null;
  const key = factKey(fact);
  return (world.premises || []).find((premise) => factKey(premise.fact) === key)?.id || null;
}

function stagedEvidenceForExactEvent(world, event, turn) {
  const staged = tutorStubPublicStagedEvidence(world, Number(turn));
  const fact = event?.semantic_payload?.fact || null;
  const premiseId = premiseIdForFact(world, fact);
  if (!premiseId || staged.some((row) => row.premise === premiseId)) return staged;
  const premise = world.premiseById.get(premiseId);
  return [
    ...staged,
    {
      premise: premiseId,
      turn: Number(turn),
      via: 'exact_current_public_event',
      surface: String(premise.surface || '').trim(),
      fact: clone(premise.fact),
    },
  ];
}

function exactUpdate(world, event) {
  const kind = ['adopt', 'derive', 'retract'].includes(event?.kind) ? event.kind : 'none';
  const fact = event?.semantic_payload?.fact || null;
  const premiseId = premiseIdForFact(world, fact);
  return {
    adopt: kind === 'adopt' && premiseId ? [premiseId] : [],
    retract: kind === 'retract' && premiseId ? [premiseId] : [],
    derive: kind === 'derive' && fact ? [clone(fact)] : [],
    hypothesis: null,
    assert_answer: null,
    human_discourse: { proof_status: 'strict_proof' },
    notes: 'deterministic exact-current-event projection',
    provider: 'deterministic',
    model: ADAPTIVE_STATE_EXACT_OBSERVER_SCHEMA,
  };
}

function hydrateInitialPublicEvidence(observer, envelope) {
  if (observer.learnerRecord.snapshots.length) return;
  const action = envelope?.current_action?.action_type;
  if (action !== 'initial_public_observation') return;
  const rows = envelope?.public_world_vocabulary?.released_evidence || [];
  if (!Array.isArray(rows)) {
    throw new Error('stateBenchmarkExactObserver: initial released evidence must be an array');
  }
  for (const row of rows) {
    if (!Array.isArray(row?.fact) || row.fact.some((value) => typeof value !== 'string')) {
      throw new Error('stateBenchmarkExactObserver: malformed initial released public fact');
    }
    observer.learnerRecord.board.set(factKey(row.fact), clone(row.fact));
  }
}

export function createAdaptiveStateExactObserver(world) {
  if (!world?.premiseById || !world?.rules || !world?.questionPattern) {
    throw new Error('stateBenchmarkExactObserver: compiled world is required');
  }
  return {
    schema: ADAPTIVE_STATE_EXACT_OBSERVER_SCHEMA,
    world,
    learnerRecord: createTutorStubPublicLearnerRecord(world),
    dropout: createTutorStubDagFactDropoutState({ rate: 0, seed: 0, graceTurns: 0, maxConcurrent: 1 }),
  };
}

export function observeAdaptiveStateExactPublicEvent({ observer, envelope, learnerText, turn } = {}) {
  if (observer?.schema !== ADAPTIVE_STATE_EXACT_OBSERVER_SCHEMA) {
    throw new Error('stateBenchmarkExactObserver: observer state is required');
  }
  const event = publicEvent(envelope);
  const kind = ['adopt', 'derive', 'retract'].includes(event?.kind) ? event.kind : 'none';
  hydrateInitialPublicEvidence(observer, envelope);
  const staged = stagedEvidenceForExactEvent(observer.world, event, turn);
  const tutorLearnerDag = applyTutorStubPublicLearnerRecordUpdate({
    update: exactUpdate(observer.world, event),
    world: observer.world,
    record: observer.learnerRecord,
    dropout: observer.dropout,
    tutorTurn: Number(turn),
    learnerText: String(learnerText || ''),
    publicStagedEvidence: staged,
    publicReleaseLedger: staged,
  });
  if (kind === 'retract' && event?.semantic_payload?.fact === null) {
    tutorLearnerDag.accepted.retract.push(event.event_id || 'unsupported_hypothesis');
  }
  return {
    schema: ADAPTIVE_STATE_EXACT_OBSERVER_SCHEMA,
    event_family: kind,
    semantic_payload: clone(event?.semantic_payload || null),
    turn_record: buildTutorStubPublicLearnerAnalysisTurnRecord({
      learnerText,
      tutorTurn: Number(turn),
      classification: exactClassification(kind),
      tutorLearnerDag,
    }),
    learner_record: observer.learnerRecord,
    dropout: observer.dropout,
  };
}
