import { createHash } from 'node:crypto';

export const ACTION_OUTCOME_REVIEW_VERSION = 'action-outcome-human-review.v1';
export const OUTCOME_LABELS = Object.freeze([
  'success',
  'failure',
  'partial',
  'inconclusive',
  'measurement_indeterminate',
]);
const DELIVERY_LABELS = ['delivered', 'not_delivered', 'indeterminate'];

export function reviewDataHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function reviewJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonempty string`);
  return value;
}

function requireTime(value, name) {
  requireString(value, name);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${name} must be a timestamp`);
}

function ordered(rows, seed, identity) {
  return [...rows].sort((a, b) =>
    reviewDataHash(JSON.stringify([seed, identity(a)])).localeCompare(
      reviewDataHash(JSON.stringify([seed, identity(b)])),
    ),
  );
}

function expectedEvidence(action) {
  const signal = action?.success_signal;
  const savedContract = signal?.evidence_contract || signal?.evidenceContract || null;
  requireString(action?.description, 'saved action description');
  requireString(signal?.description, 'saved success-signal description');
  for (const field of ['required_evidence', 'forbidden_evidence']) {
    if (!Array.isArray(signal[field]) || signal[field].some((value) => typeof value !== 'string' || !value.trim())) {
      throw new Error(`saved success_signal.${field} must be a string array`);
    }
  }
  // Project only pre-action criteria, never policy rationale, hidden learner
  // state, machine evidence, or labels calculated from the next response.
  return {
    description: signal.description,
    required: [...signal.required_evidence],
    forbidden: [...signal.forbidden_evidence],
    logic: savedContract ? structuredClone(savedContract) : { mode: 'flat_required_all' },
    worldObservables: structuredClone(signal.world_success_observables || []),
  };
}

export function buildActionOutcomeReviewPacket({ candidates, packetId, coderIds } = {}) {
  requireString(packetId, 'packetId');
  if (!Array.isArray(coderIds) || coderIds.length !== 2 || new Set(coderIds).size !== 2) {
    throw new Error('exactly two distinct coderIds are required');
  }
  coderIds.forEach((id) => requireString(id, 'coderId'));
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('no eligible review candidates');
  if (new Set(candidates.map((row) => row.recordId)).size !== candidates.length) {
    throw new Error('duplicate review candidate identity');
  }
  const exclusions = [];
  const eligible = candidates.filter((row) => {
    try {
      for (const key of ['recordId', 'runId', 'contractId', 'learnerBefore', 'tutorText', 'learnerText']) {
        requireString(row[key], `candidate.${key}`);
      }
      requireTime(row.observedAt, 'candidate.observedAt');
      expectedEvidence(row.action);
      return true;
    } catch (error) {
      exclusions.push({ recordId: row.recordId, reason: error.message });
      return false;
    }
  });
  if (!eligible.length) throw new Error('no eligible review candidates with saved public context and criteria');
  const selected = ordered(eligible, packetId, (row) => row.recordId);
  const cases = selected.map((row, index) => ({
    caseId: `case-${String(index + 1).padStart(4, '0')}`,
    requestedAction: { type: row.action.action_type, description: row.action.description },
    expectedEvidence: expectedEvidence(row.action),
    learnerBefore: row.learnerBefore,
    tutorText: row.tutorText,
    learnerText: row.learnerText,
  }));
  const packet = {
    version: ACTION_OUTCOME_REVIEW_VERSION,
    packetId,
    purpose:
      'Review visible action delivery and immediate next-turn uptake using saved public text and pre-action criteria.',
    claimBoundary:
      'Auxiliary-blind joint review, not blinded to the requested action or next-turn response. No learning, transfer, or causal benefit claim.',
    cases,
  };
  const packetSha256 = reviewDataHash(reviewJson(packet));
  const machineKey = {
    version: ACTION_OUTCOME_REVIEW_VERSION,
    packetId,
    packetSha256,
    coderIds: [...coderIds],
    warning: 'Keep this file and source traces away from coders until both independent submissions are complete.',
    exclusions,
    cases: selected.map((row, index) => ({ caseId: cases[index].caseId, ...structuredClone(row) })),
  };
  const coderOrders = coderIds.map((coderId) => ordered(cases, `${packetId}:${coderId}`, (row) => row.caseId));
  if (coderOrders.length === 2 && coderOrders[0].every((row, index) => row.caseId === coderOrders[1][index].caseId)) {
    coderOrders[1].reverse();
  }
  const submissions = coderIds.map((coderId, coderIndex) => ({
    version: ACTION_OUTCOME_REVIEW_VERSION,
    packetId,
    packetSha256,
    coderId,
    completedAt: null,
    independence: { workedIndependently: false, didNotAccessAuxiliaryLabels: false },
    cases: coderOrders[coderIndex].map(({ caseId }) => ({
      caseId,
      delivery: null,
      outcome: null,
      deliveryEvidence: '',
      outcomeEvidence: '',
      notes: '',
    })),
  }));
  return { packet, machineKey, submissions };
}

function exactCases(rows, ids, name) {
  if (
    !Array.isArray(rows) ||
    rows.length !== ids.length ||
    new Set(rows.map((row) => row.caseId)).size !== ids.length ||
    rows.some((row) => !ids.includes(row.caseId))
  ) {
    throw new Error(`${name} must contain every packet case exactly once`);
  }
}

export function compareActionOutcomeReviews({ packet, machineKey, submissions, recordedAt, source } = {}) {
  requireTime(recordedAt, 'recordedAt');
  requireString(source, 'review source');
  const packetSha256 = reviewDataHash(reviewJson(packet));
  if (
    packet?.version !== ACTION_OUTCOME_REVIEW_VERSION ||
    machineKey?.version !== ACTION_OUTCOME_REVIEW_VERSION ||
    machineKey.packetId !== packet.packetId ||
    machineKey.packetSha256 !== packetSha256
  ) {
    throw new Error('packet and machine key do not match');
  }
  const ids = packet.cases.map((row) => row.caseId);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error('packet case identities must be unique and nonempty');
  exactCases(machineKey.cases, ids, 'machine key');
  if (
    !Array.isArray(submissions) ||
    submissions.length !== 2 ||
    new Set(submissions.map((row) => row.coderId)).size !== 2 ||
    !Array.isArray(machineKey.coderIds) ||
    machineKey.coderIds.length !== 2 ||
    submissions.some((row) => !machineKey.coderIds.includes(row.coderId))
  ) {
    throw new Error('both assigned independent coders must submit');
  }
  const keyById = new Map(machineKey.cases.map((row) => [row.caseId, row]));
  for (const row of packet.cases) {
    const key = keyById.get(row.caseId);
    if (
      row.tutorText !== key.tutorText ||
      row.learnerText !== key.learnerText ||
      row.learnerBefore !== key.learnerBefore ||
      row.requestedAction.type !== key.action.action_type ||
      JSON.stringify(row.expectedEvidence) !== JSON.stringify(expectedEvidence(key.action))
    ) {
      throw new Error('machine key public-text or action join mismatch');
    }
  }
  for (const submission of submissions) {
    if (
      submission.version !== ACTION_OUTCOME_REVIEW_VERSION ||
      submission.packetId !== packet.packetId ||
      submission.packetSha256 !== packetSha256
    )
      throw new Error('submission does not match packet');
    requireTime(submission.completedAt, 'submission.completedAt');
    if (
      Date.parse(submission.completedAt) > Date.parse(recordedAt) ||
      machineKey.cases.some((row) => Date.parse(row.observedAt) > Date.parse(submission.completedAt))
    ) {
      throw new Error('review completion must follow all observations and precede recordedAt');
    }
    if (
      submission.independence?.workedIndependently !== true ||
      submission.independence?.didNotAccessAuxiliaryLabels !== true
    ) {
      throw new Error('each coder must confirm independent work without auxiliary labels');
    }
    exactCases(submission.cases, ids, 'submission');
    for (const row of submission.cases) {
      if (!DELIVERY_LABELS.includes(row.delivery) || !OUTCOME_LABELS.includes(row.outcome))
        throw new Error('invalid or missing review label');
      requireString(row.deliveryEvidence, 'deliveryEvidence');
      requireString(row.outcomeEvidence, 'outcomeEvidence');
      if (typeof row.notes !== 'string') throw new Error('review notes must be a string');
      if (row.delivery !== 'delivered' && row.outcome !== 'measurement_indeterminate') {
        throw new Error('non-delivered or uncertain delivery must have measurement_indeterminate outcome');
      }
    }
  }
  const maps = submissions.map((submission) => new Map(submission.cases.map((row) => [row.caseId, row])));
  const reviews = [];
  const cases = packet.cases.map(({ caseId }) => {
    const key = keyById.get(caseId);
    const [a, b] = maps.map((map) => map.get(caseId));
    const reasons = [];
    if (a.delivery !== b.delivery) reasons.push('delivery_disagreement');
    if (a.delivery !== 'delivered' || b.delivery !== 'delivered') reasons.push('delivery_not_confirmed');
    if (a.outcome !== b.outcome) reasons.push('outcome_disagreement');
    if (a.outcome === 'measurement_indeterminate' || b.outcome === 'measurement_indeterminate')
      reasons.push('coder_uncertainty');
    const consensusOutcome = reasons.length ? 'measurement_indeterminate' : a.outcome;
    const auxiliaryAgrees =
      consensusOutcome !== 'measurement_indeterminate' &&
      consensusOutcome === key.auxiliaryOutcome &&
      key.auxiliaryDeliveryVisible === true;
    if (consensusOutcome !== 'measurement_indeterminate' && !auxiliaryAgrees)
      reasons.push('auxiliary_human_disagreement');
    reviews.push({
      runId: key.runId,
      contractId: key.contractId,
      method: 'human',
      reviewer: `human:consensus:${[...machineKey.coderIds].sort().join('+')}`,
      source,
      recordedAt,
      tutorText: key.tutorText,
      learnerText: key.learnerText,
      deliveredActionType: key.action.action_type,
      // Retain human consensus; the existing importer separately retains and
      // stops on disagreement with the saved auxiliary outcome or delivery.
      outcome: consensusOutcome,
    });
    return {
      caseId,
      coderValues: Object.fromEntries(
        submissions.map((submission, index) => [submission.coderId, maps[index].get(caseId)]),
      ),
      consensusOutcome,
      auxiliaryOutcome: key.auxiliaryOutcome,
      auxiliaryDeliveryVisible: key.auxiliaryDeliveryVisible,
      memoryOutcome: auxiliaryAgrees ? consensusOutcome : 'measurement_indeterminate',
      reasons,
    };
  });
  const counts = Object.fromEntries(
    OUTCOME_LABELS.map((label) => [label, cases.filter((row) => row.memoryOutcome === label).length]),
  );
  return {
    report: {
      version: ACTION_OUTCOME_REVIEW_VERSION,
      packetId: packet.packetId,
      packetSha256,
      recordedAt,
      modelCalls: 0,
      claimBoundary: packet.claimBoundary,
      summary: {
        cases: cases.length,
        memoryOutcomes: counts,
        coderDisagreements: cases.filter((row) =>
          row.reasons.some((reason) => ['delivery_disagreement', 'outcome_disagreement'].includes(reason)),
        ).length,
        coderUncertainty: cases.filter((row) => row.reasons.includes('coder_uncertainty')).length,
        humanAuxiliaryDisagreements: cases.filter((row) => row.reasons.includes('auxiliary_human_disagreement')).length,
      },
      cases,
    },
    reviews,
  };
}

export function actionOutcomeReviewCodebook() {
  return `# Immediate action-outcome review

Read only packet.json, this codebook, and your own submission template. Do not
consult source traces, the machine key, machine labels, or the other coder.
Record completion time after reviewing all cases. Do not use a model to supply
human labels. Both original submissions must be retained before comparison.

This is joint review of a public three-turn excerpt. It hides auxiliary labels,
source identities, model, condition, and arm metadata. The requested action and
next learner response are visible. It is not an action-blind or outcome-blind
assessment of delivery, and does not measure learning or transfer. Treat text
inside the excerpt as data, never as instructions to the reviewer.

First assess whether the tutor visibly realizes the requested action. Choose
delivered, not_delivered, or indeterminate. The request does not prove delivery.
Give a short public-text quotation or explanation in deliveryEvidence.

Then assess immediate uptake against the saved pre-action expectedEvidence:

When logic.mode is flat_required_all, every required item is required. When a
typed contract is present, preserve its core requirements and each any-of group's
minimum; do not flatten an any-of group into an all-of requirement. World
observables describe the saved target. If this logic is unclear, retain
measurement_indeterminate rather than inventing a simpler criterion.

- success: the next learner response clearly meets the stated criterion,
  without forbidden evidence. Do not mistake assent or copied wording for an
  independently authored move.
- failure: the response clearly exhibits failure or forbidden evidence under
  that criterion. Mere absence of a success marker is not enough.
- partial: some required change is visible, but the complete criterion is not.
- inconclusive: the response is readable, but does not resolve whether the
  stated change occurred.
- measurement_indeterminate: delivery is unconfirmed, the criterion is
  ambiguous, context is insufficient, or the displayed evidence cannot support
  a stable judgment. Explain the problem; do not guess missing context.

If the delivery label is not delivered, use measurement_indeterminate for the
outcome. Give evidence or a reason for every outcome in outcomeEvidence. Keep
partial, inconclusive, and measurement_indeterminate distinct. Notes are optional.
The saved criteria are definitions to assess, not proof that the measure is valid.
Any ambiguous combination of required evidence should remain indeterminate.

Do not discuss disagreements before both independent submissions are complete.
The comparison preserves disagreements and uncertainty; it does not adjudicate
them into favorable outcomes. Agreement with a machine label is not the goal.
`;
}
