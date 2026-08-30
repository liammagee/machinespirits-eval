import { closure, factKey, ruleFirings } from './chainer.js';

export const PROOF_DAG_REVIEW_SPEC_SCHEMA = 'dramatic-derivation.proof-dag-review-spec.v1';
export const PROOF_DAG_REVIEW_PACKET_SCHEMA = 'dramatic-derivation.proof-dag-review-packet.v1';
export const PROOF_DAG_REVIEW_KEY_SCHEMA = 'dramatic-derivation.proof-dag-review-machine-key.v1';
export const PROOF_DAG_REVIEW_SUBMISSION_SCHEMA = 'dramatic-derivation.proof-dag-review-submission.v1';
export const PROOF_DAG_REVIEW_REPORT_SCHEMA = 'dramatic-derivation.proof-dag-review-report.v1';

const REVIEW_DIMENSIONS = Object.freeze([
  'available_premise_ids',
  'enabled_rule_ids',
  'licensed_candidate_ids',
  'forbidden_candidate_ids',
]);
const DISPOSITIONS = new Set(['determinate', 'indeterminate']);

function fail(message) {
  throw new Error(`proof-DAG review: ${message}`);
}

function humanizeAtom(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function factPlainLanguage(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return '';
  const [relation, ...arguments_] = fact.map(humanizeAtom);
  return arguments_.length === 0 ? relation : `${relation}: ${arguments_.join(' · ')}`;
}

function unique(values) {
  return [...new Set(values)];
}

function exactSetEqual(left, right) {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function neutralCandidates(world) {
  return [world.secret, world.mirror]
    .filter((candidate) => candidate?.fact)
    .map((candidate) => ({ fact: candidate.fact }))
    .sort((left, right) => factKey(left.fact).localeCompare(factKey(right.fact)))
    .map((candidate, index) => ({
      candidate_id: `candidate_${index + 1}`,
      fact: candidate.fact,
      plain_language: factPlainLanguage(candidate.fact),
    }));
}

function publicPrefix(world, turn) {
  const ledger = world.releaseSchedule.filter((entry) => entry.turn <= turn);
  const releasedEvidence = ledger.map((entry) => {
    const premise = world.premiseById.get(entry.premise);
    return {
      premise_id: premise.id,
      release_turn: entry.turn,
      via: entry.via,
      presentation: entry.presentation || null,
      fact: premise.fact,
      plain_language: factPlainLanguage(premise.fact),
      surface: premise.surface || factPlainLanguage(premise.fact),
    };
  });
  return {
    ledger,
    releasedEvidence,
    facts: [...world.background, ...releasedEvidence.map((entry) => entry.fact)],
  };
}

function validateReviewSpec(spec, loadedWorlds) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('spec must be an object');
  if (spec.schema !== PROOF_DAG_REVIEW_SPEC_SCHEMA) {
    fail(`spec schema must be ${PROOF_DAG_REVIEW_SPEC_SCHEMA}`);
  }
  if (!String(spec.packet_id || '').trim()) fail('spec packet_id is required');
  if (!Array.isArray(spec.worlds) || spec.worlds.length < 3) {
    fail('spec must select at least three worlds');
  }
  if (!Array.isArray(loadedWorlds) || loadedWorlds.length !== spec.worlds.length) {
    fail('loaded worlds must align one-for-one with spec worlds');
  }

  const worldIds = [];
  const caseIds = [];
  for (const [index, selection] of spec.worlds.entries()) {
    const world = loadedWorlds[index];
    if (!world || world.id !== selection.world_id) {
      fail(`loaded world ${index + 1} does not match ${selection.world_id}`);
    }
    if (!String(selection.source || '').trim()) fail(`${selection.world_id} source is required`);
    if (!Array.isArray(selection.cases) || selection.cases.length === 0) {
      fail(`${selection.world_id} needs at least one sampled release turn`);
    }
    worldIds.push(world.id);
    const releaseTurns = new Set(world.releaseSchedule.map((entry) => entry.turn));
    for (const sample of selection.cases) {
      const caseId = String(sample.case_id || '').trim();
      if (!caseId) fail(`${selection.world_id} has a case without case_id`);
      if (!Number.isInteger(sample.turn) || !releaseTurns.has(sample.turn)) {
        fail(`${caseId} turn ${sample.turn} is not a scheduled release turn in ${world.id}`);
      }
      caseIds.push(caseId);
    }
  }
  if (new Set(worldIds).size !== worldIds.length) fail('spec world ids must be unique');
  if (new Set(caseIds).size !== caseIds.length) fail('spec case ids must be unique');
}

function publicRule(rule) {
  return {
    rule_id: rule.id,
    plain_language: rule.gloss || '',
    when: rule.if,
    then: rule.then,
  };
}

function buildCase(world, sample, candidates) {
  const prefix = publicPrefix(world, sample.turn);
  return {
    case_id: sample.case_id,
    turn: sample.turn,
    review_question:
      'At the end of this release turn, which listed premises are public, which rules can fire, and which neutral candidate conclusions are licensed or still forbidden?',
    release_ledger: prefix.releasedEvidence.map(({ premise_id, release_turn, via, presentation }) => ({
      premise_id,
      release_turn,
      via,
      presentation,
    })),
    public_background: world.background.map((fact) => ({ fact, plain_language: factPlainLanguage(fact) })),
    released_evidence: prefix.releasedEvidence,
    candidate_conclusions: candidates,
  };
}

function buildMachineRuling(world, reviewCase, candidates) {
  const prefix = publicPrefix(world, reviewCase.turn);
  const result = closure(prefix.facts, world.rules);
  const baseKeys = new Set(prefix.facts.map(factKey));
  const firings = ruleFirings(prefix.facts, world.rules);
  const licensedCandidateIds = candidates
    .filter((candidate) => result.facts.has(factKey(candidate.fact)))
    .map((candidate) => candidate.candidate_id);
  const forbiddenCandidateIds = candidates
    .filter((candidate) => !result.facts.has(factKey(candidate.fact)))
    .map((candidate) => candidate.candidate_id);

  return {
    case_id: reviewCase.case_id,
    available_premise_ids: unique(prefix.ledger.map((entry) => entry.premise)),
    enabled_rule_ids: unique(firings.map((entry) => entry.rule)),
    enabled_rule_firings: firings.map((entry) => ({
      rule_id: entry.rule,
      premises: entry.premises,
      conclusions: entry.conclusions,
    })),
    derived_conclusions: [...result.facts]
      .filter(([key]) => !baseKeys.has(key))
      .map(([, fact]) => ({ fact, plain_language: factPlainLanguage(fact) })),
    licensed_candidate_ids: licensedCandidateIds,
    forbidden_candidate_ids: forbiddenCandidateIds,
  };
}

export function buildProofDagReviewArtifacts({ spec, loadedWorlds }) {
  validateReviewSpec(spec, loadedWorlds);

  const packetWorlds = [];
  const machineCases = [];
  for (const [index, selection] of spec.worlds.entries()) {
    const world = loadedWorlds[index];
    const candidates = neutralCandidates(world);
    const cases = selection.cases.map((sample) => buildCase(world, sample, candidates));
    packetWorlds.push({
      world_id: world.id,
      source: selection.source,
      title: world.title,
      discipline: world.discipline,
      public_question: world.question,
      public_rules: world.rules.map(publicRule),
      cases,
    });
    for (const reviewCase of cases) {
      machineCases.push(buildMachineRuling(world, reviewCase, candidates));
    }
  }

  const packet = {
    schema: PROOF_DAG_REVIEW_PACKET_SCHEMA,
    packet_id: spec.packet_id,
    purpose:
      'Independent semantic review of authored proof and release timing across materially different worlds; this is not tutor-output or efficacy evidence.',
    blinding: {
      excludes: ['tutor outputs', 'learner outputs', 'downstream outcomes', 'machine rulings'],
      neutral_candidate_labels: true,
    },
    coding_instructions: [
      'Use only the public prefix printed in each case; do not import evidence from another turn.',
      'Mark a rule enabled only when every antecedent is public or follows from another enabled rule.',
      'A neutral candidate is licensed only when the public prefix and rules entail it.',
      'Keep a tempting candidate forbidden when its required path is incomplete, even if it later becomes plausible.',
      'If the wording or rule semantics do not support a confident ruling, mark the affected field indeterminate and explain why.',
    ],
    response_fields: REVIEW_DIMENSIONS,
    worlds: packetWorlds,
  };

  const machineKey = {
    schema: PROOF_DAG_REVIEW_KEY_SCHEMA,
    packet_id: spec.packet_id,
    warning: 'Do not provide this machine-derived key to reviewers before both independent submissions are frozen.',
    cases: machineCases,
  };

  return { packet, machineKey };
}

function packetCases(packet) {
  return packet.worlds.flatMap((world) =>
    world.cases.map((reviewCase) => ({
      ...reviewCase,
      world_id: world.world_id,
      rule_ids: world.public_rules.map((rule) => rule.rule_id),
    })),
  );
}

export function createProofDagReviewSubmissionTemplate(packet) {
  return {
    schema: PROOF_DAG_REVIEW_SUBMISSION_SCHEMA,
    packet_id: packet.packet_id,
    reviewer_id: 'REPLACE_WITH_REVIEWER_ID',
    cases: packetCases(packet).map((reviewCase) => ({
      case_id: reviewCase.case_id,
      disposition: 'determinate',
      available_premise_ids: [],
      enabled_rule_ids: [],
      licensed_candidate_ids: [],
      forbidden_candidate_ids: [],
      indeterminate_fields: [],
      notes: '',
    })),
  };
}

function requireKnownUniqueIds(values, allowed, field, caseId) {
  if (!Array.isArray(values)) fail(`${caseId}.${field} must be an array`);
  if (new Set(values).size !== values.length) fail(`${caseId}.${field} must not contain duplicates`);
  const unknown = values.filter((value) => !allowed.has(value));
  if (unknown.length > 0) fail(`${caseId}.${field} contains unknown ids: ${unknown.join(', ')}`);
}

export function validateProofDagReviewSubmission(packet, submission) {
  if (submission?.schema !== PROOF_DAG_REVIEW_SUBMISSION_SCHEMA) {
    fail(`submission schema must be ${PROOF_DAG_REVIEW_SUBMISSION_SCHEMA}`);
  }
  if (submission.packet_id !== packet.packet_id) fail('submission packet_id does not match packet');
  if (!String(submission.reviewer_id || '').trim() || submission.reviewer_id === 'REPLACE_WITH_REVIEWER_ID') {
    fail('submission reviewer_id must identify the independent reviewer');
  }
  if (!Array.isArray(submission.cases)) fail('submission cases must be an array');

  const cases = packetCases(packet);
  const caseById = new Map(cases.map((reviewCase) => [reviewCase.case_id, reviewCase]));
  if (submission.cases.length !== cases.length) fail('submission must contain every packet case exactly once');
  if (new Set(submission.cases.map((row) => row.case_id)).size !== submission.cases.length) {
    fail('submission case ids must be unique');
  }

  for (const row of submission.cases) {
    const reviewCase = caseById.get(row.case_id);
    if (!reviewCase) fail(`submission contains unknown case ${row.case_id}`);
    if (!DISPOSITIONS.has(row.disposition)) fail(`${row.case_id}.disposition must be determinate or indeterminate`);
    const premiseIds = new Set(reviewCase.released_evidence.map((entry) => entry.premise_id));
    const ruleIds = new Set(reviewCase.rule_ids);
    const candidateIds = new Set(reviewCase.candidate_conclusions.map((entry) => entry.candidate_id));
    requireKnownUniqueIds(row.available_premise_ids, premiseIds, 'available_premise_ids', row.case_id);
    requireKnownUniqueIds(row.enabled_rule_ids, ruleIds, 'enabled_rule_ids', row.case_id);
    requireKnownUniqueIds(row.licensed_candidate_ids, candidateIds, 'licensed_candidate_ids', row.case_id);
    requireKnownUniqueIds(row.forbidden_candidate_ids, candidateIds, 'forbidden_candidate_ids', row.case_id);
    requireKnownUniqueIds(row.indeterminate_fields, new Set(REVIEW_DIMENSIONS), 'indeterminate_fields', row.case_id);
    if (typeof row.notes !== 'string') fail(`${row.case_id}.notes must be a string`);

    const candidateOverlap = row.licensed_candidate_ids.filter((id) => row.forbidden_candidate_ids.includes(id));
    if (candidateOverlap.length > 0) {
      fail(`${row.case_id} marks candidates both licensed and forbidden: ${candidateOverlap.join(', ')}`);
    }
    if (row.disposition === 'determinate') {
      if (row.indeterminate_fields.length > 0) {
        fail(`${row.case_id} determinate ruling cannot name indeterminate fields`);
      }
      if (!exactSetEqual([...row.licensed_candidate_ids, ...row.forbidden_candidate_ids], [...candidateIds])) {
        fail(`${row.case_id} determinate ruling must classify every candidate`);
      }
    } else if (row.indeterminate_fields.length === 0) {
      fail(`${row.case_id} indeterminate ruling must name at least one indeterminate field`);
    }
  }

  return submission;
}

export function compareProofDagReviewSubmissions({ packet, machineKey, submissions }) {
  if (machineKey?.schema !== PROOF_DAG_REVIEW_KEY_SCHEMA || machineKey.packet_id !== packet.packet_id) {
    fail('machine key does not match packet');
  }
  const expectedCaseIds = packetCases(packet).map((row) => row.case_id);
  if (
    !Array.isArray(machineKey.cases) ||
    machineKey.cases.length !== expectedCaseIds.length ||
    new Set(machineKey.cases.map((row) => row.case_id)).size !== machineKey.cases.length ||
    !exactSetEqual(
      machineKey.cases.map((row) => row.case_id),
      expectedCaseIds,
    )
  ) {
    fail('machine key must contain every packet case exactly once');
  }
  if (!Array.isArray(submissions) || submissions.length < 2) fail('at least two independent submissions are required');
  const validated = submissions.map((submission) => validateProofDagReviewSubmission(packet, submission));
  const reviewerIds = validated.map((submission) => submission.reviewer_id);
  if (new Set(reviewerIds).size !== reviewerIds.length) fail('reviewer ids must be unique');

  const keyByCase = new Map(machineKey.cases.map((row) => [row.case_id, row]));
  const submissionsByReviewer = validated.map(
    (submission) => new Map(submission.cases.map((row) => [row.case_id, row])),
  );
  const cases = packetCases(packet).map((reviewCase) => {
    const rows = submissionsByReviewer.map((byCase) => byCase.get(reviewCase.case_id));
    const machine = keyByCase.get(reviewCase.case_id);
    if (!machine) fail(`machine key is missing ${reviewCase.case_id}`);
    const dimensions = {};
    for (const dimension of REVIEW_DIMENSIONS) {
      const indeterminateByReviewer = rows.flatMap((row, index) =>
        row.disposition === 'indeterminate' && row.indeterminate_fields.includes(dimension)
          ? [validated[index].reviewer_id]
          : [],
      );
      const agreed = rows.slice(1).every((row) => exactSetEqual(rows[0][dimension], row[dimension]));
      if (indeterminateByReviewer.length > 0 || !agreed) {
        dimensions[dimension] = {
          status: 'indeterminate',
          indeterminate_by: indeterminateByReviewer,
          reviewer_values: Object.fromEntries(
            validated.map((submission, index) => [submission.reviewer_id, rows[index][dimension]]),
          ),
        };
      } else {
        const consensus = [...rows[0][dimension]].sort();
        dimensions[dimension] = {
          status: 'determinate',
          consensus,
          matches_machine: exactSetEqual(consensus, machine[dimension]),
        };
      }
    }
    const status = Object.values(dimensions).every((dimension) => dimension.status === 'determinate')
      ? 'determinate'
      : 'indeterminate';
    const reviewerRulings = Object.fromEntries(
      validated.map((submission, index) => [
        submission.reviewer_id,
        {
          disposition: rows[index].disposition,
          indeterminate_fields: rows[index].indeterminate_fields,
          notes: rows[index].notes,
        },
      ]),
    );
    return {
      case_id: reviewCase.case_id,
      world_id: reviewCase.world_id,
      turn: reviewCase.turn,
      status,
      reviewer_rulings: reviewerRulings,
      dimensions,
    };
  });

  return {
    schema: PROOF_DAG_REVIEW_REPORT_SCHEMA,
    packet_id: packet.packet_id,
    reviewer_ids: reviewerIds,
    summary: {
      total_cases: cases.length,
      determinate_cases: cases.filter((row) => row.status === 'determinate').length,
      indeterminate_cases: cases.filter((row) => row.status === 'indeterminate').length,
      all_determinate_dimensions_match_machine: cases.every((reviewCase) =>
        Object.values(reviewCase.dimensions).every(
          (dimension) => dimension.status === 'indeterminate' || dimension.matches_machine === true,
        ),
      ),
    },
    cases,
  };
}
