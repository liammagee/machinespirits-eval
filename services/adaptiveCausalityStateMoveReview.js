import crypto from 'node:crypto';

export const STATE_MOVE_SPEC_SCHEMA = 'adaptive-causality.state-move-review-spec.v1';
export const STATE_MOVE_PACKET_SCHEMA = 'adaptive-causality.state-move-review-packet.v1';
export const STATE_MOVE_KEY_SCHEMA = 'adaptive-causality.state-move-review-machine-key.v1';
export const STATE_MOVE_SUBMISSION_SCHEMA = 'adaptive-causality.state-move-review-submission.v1';
export const STATE_MOVE_REPORT_SCHEMA = 'adaptive-causality.state-move-review-report.v1';
export const STATE_MOVE_HASH_MANIFEST_SCHEMA = 'adaptive-causality.state-move-review-hashes.v1';

const DISPOSITIONS = new Set(['determinate', 'indeterminate']);
const SPECIAL_STATE_LABELS = new Set(['other_state']);
const SPECIAL_MOVE_LABELS = new Set(['other_observable', 'none_observable']);

function fail(message) {
  throw new Error(`adaptive state/move review: ${message}`);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, field) {
  if (!String(value || '').trim()) fail(`${field} is required`);
  return String(value).trim();
}

function requireSha256(value, field) {
  if (!/^[a-f0-9]{64}$/u.test(String(value || ''))) fail(`${field} must be a lowercase SHA-256 digest`);
  return value;
}

function exactSetEqual(left, right) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function catalogByCode(entries, field) {
  if (!Array.isArray(entries) || entries.length === 0) fail(`${field} must be a non-empty array`);
  const map = new Map();
  for (const entry of entries) {
    if (!isRecord(entry)) fail(`${field} entries must be objects`);
    const code = requireString(entry.code, `${field}.code`);
    if (map.has(code)) fail(`${field} contains duplicate code ${code}`);
    requireString(entry.label, `${field}.${code}.label`);
    requireString(entry.definition, `${field}.${code}.definition`);
    if (!Array.isArray(entry.include) || entry.include.length === 0) fail(`${field}.${code}.include is required`);
    if (!Array.isArray(entry.exclude) || entry.exclude.length === 0) fail(`${field}.${code}.exclude is required`);
    map.set(code, entry);
  }
  return map;
}

function validateSpec(spec) {
  if (!isRecord(spec)) fail('spec must be an object');
  if (spec.schema !== STATE_MOVE_SPEC_SCHEMA) fail(`spec schema must be ${STATE_MOVE_SPEC_SCHEMA}`);
  requireString(spec.packet_id, 'spec.packet_id');
  requireString(spec.seed, 'spec.seed');
  requireString(spec.codebook_id, 'spec.codebook_id');
  if (!Array.isArray(spec.worlds) || spec.worlds.length < 2) fail('spec.worlds must contain at least two worlds');
  if (new Set(spec.worlds).size !== spec.worlds.length) fail('spec.worlds must be unique');
  if (!Number.isInteger(spec.per_stratum) || spec.per_stratum < 1) fail('spec.per_stratum must be a positive integer');

  const states = catalogByCode(spec.states, 'spec.states');
  const moves = catalogByCode(spec.moves, 'spec.moves');
  for (const state of spec.states) {
    requireString(state.source_id, `spec.states.${state.code}.source_id`);
    requireString(state.source_value, `spec.states.${state.code}.source_value`);
    const goldMove = requireString(state.gold_move, `spec.states.${state.code}.gold_move`);
    if (!moves.has(goldMove)) fail(`spec.states.${state.code}.gold_move references unknown move ${goldMove}`);
  }

  if (!Array.isArray(spec.sources) || spec.sources.length === 0) fail('spec.sources must be a non-empty array');
  const sourceIds = new Set();
  for (const source of spec.sources) {
    const sourceId = requireString(source.source_id, 'spec.sources.source_id');
    if (sourceIds.has(sourceId)) fail(`spec.sources contains duplicate source_id ${sourceId}`);
    sourceIds.add(sourceId);
    requireString(source.file, `spec.sources.${sourceId}.file`);
    requireSha256(source.sha256, `spec.sources.${sourceId}.sha256`);
    requireString(source.arm_field, `spec.sources.${sourceId}.arm_field`);
    requireString(source.forced_move_field, `spec.sources.${sourceId}.forced_move_field`);
    requireString(source.state_field, `spec.sources.${sourceId}.state_field`);
  }
  for (const state of spec.states) {
    if (!sourceIds.has(state.source_id)) fail(`state ${state.code} references unknown source ${state.source_id}`);
  }

  const moveBySourceValue = new Map();
  for (const move of spec.moves) {
    if (!Array.isArray(move.source_values) || move.source_values.length === 0) {
      fail(`spec.moves.${move.code}.source_values is required`);
    }
    for (const value of move.source_values) {
      const sourceValue = requireString(value, `spec.moves.${move.code}.source_values`);
      if (moveBySourceValue.has(sourceValue)) fail(`source move ${sourceValue} maps to multiple move codes`);
      moveBySourceValue.set(sourceValue, move.code);
    }
  }
  return { states, moves, moveBySourceValue };
}

function sourceRowIdentity(source, row) {
  return [
    source.source_id,
    row.world,
    row[source.arm_field],
    row.k,
    row.turn,
    row[source.state_field],
    row[source.forced_move_field],
  ].join('\u001f');
}

function validateSourceRows(spec, source, document) {
  if (!isRecord(document)) fail(`source document ${source.source_id} must be an object`);
  if (document.source_id !== source.source_id) fail(`source document id does not match ${source.source_id}`);
  if (sha256(document.bytes) !== source.sha256) fail(`sealed source hash mismatch for ${source.file}`);
  if (!Array.isArray(document.rows)) fail(`${source.file} must contain a JSON array`);
  const identities = new Set();
  for (const [index, row] of document.rows.entries()) {
    if (!isRecord(row)) fail(`${source.file}[${index}] must be an object`);
    for (const field of ['world', 'k', 'turn', 'learner', 'reply', source.arm_field, source.state_field]) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        fail(`${source.file}[${index}].${field} is required`);
      }
    }
    if (!spec.worlds.includes(row.world)) continue;
    const identity = sourceRowIdentity(source, row);
    if (identities.has(identity)) fail(`${source.file} contains duplicate row identity ${identity}`);
    identities.add(identity);
  }
}

function normalizedRows(spec, sourceDocuments, catalogs) {
  const stateBySource = new Map(spec.states.map((state) => [`${state.source_id}\u001f${state.source_value}`, state]));
  const documentsById = new Map(sourceDocuments.map((document) => [document.source_id, document]));
  if (documentsById.size !== spec.sources.length) fail('source documents must align one-for-one with spec.sources');

  const rows = [];
  for (const source of spec.sources) {
    const document = documentsById.get(source.source_id);
    if (!document) fail(`missing source document ${source.source_id}`);
    validateSourceRows(spec, source, document);
    for (const row of document.rows) {
      if (!spec.worlds.includes(row.world)) continue;
      const state = stateBySource.get(`${source.source_id}\u001f${row[source.state_field]}`);
      if (!state) continue;
      // The natural router rows have no randomized/forced assignment. They are
      // valuable outcome evidence but cannot enter a matched-versus-mismatched
      // assignment stratum without inventing an arm after the fact.
      if (row[source.forced_move_field] === null || row[source.forced_move_field] === undefined) continue;
      const assignedMove = catalogs.moveBySourceValue.get(row[source.forced_move_field]);
      if (!assignedMove) fail(`unknown forced move ${row[source.forced_move_field]} in ${source.file}`);
      if (typeof row.ruled !== 'boolean') fail(`${source.file} selected row must contain boolean ruled`);
      const identity = sourceRowIdentity(source, row);
      rows.push({
        identity,
        source,
        row,
        state,
        assignedMove,
        assignmentRelation: assignedMove === state.gold_move ? 'matched' : 'mismatched',
      });
    }
  }
  return rows;
}

function stratifiedSelection(spec, rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = [row.state.code, row.row.world, row.assignmentRelation].join('\u001f');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const selected = [];
  for (const state of spec.states) {
    for (const world of spec.worlds) {
      for (const relation of ['matched', 'mismatched']) {
        const key = [state.code, world, relation].join('\u001f');
        const candidates = grouped.get(key) || [];
        if (candidates.length < spec.per_stratum) {
          fail(`stratum ${state.code}/${world}/${relation} has ${candidates.length}; needs ${spec.per_stratum}`);
        }
        candidates.sort((left, right) =>
          sha256(`${spec.seed}\u001fsample\u001f${left.identity}`).localeCompare(
            sha256(`${spec.seed}\u001fsample\u001f${right.identity}`),
          ),
        );
        selected.push(...candidates.slice(0, spec.per_stratum));
      }
    }
  }
  selected.sort((left, right) =>
    sha256(`${spec.seed}\u001fpublic-order\u001f${left.identity}`).localeCompare(
      sha256(`${spec.seed}\u001fpublic-order\u001f${right.identity}`),
    ),
  );
  return selected;
}

function selectedCase(row, index) {
  return {
    case_id: `case_${String(index + 1).padStart(3, '0')}`,
    learner_turn: row.row.learner,
    tutor_reply: row.row.reply,
  };
}

function machineCase(row, reviewCase) {
  const sourceArm = row.row[row.source.arm_field];
  return {
    case_id: reviewCase.case_id,
    source_id: row.source.source_id,
    source_locator: {
      world: row.row.world,
      arm: sourceArm,
      repetition: row.row.k,
      turn: row.row.turn,
      source_state: row.row[row.source.state_field],
      forced_move: row.row[row.source.forced_move_field],
    },
    expected_state: row.state.code,
    assigned_move: row.assignedMove,
    gold_move: row.state.gold_move,
    assignment_relation: row.assignmentRelation,
    automated: {
      tag: row.row.tag ?? null,
      raw_hit: row.row.hit ?? null,
      ruled_gold_realization: row.row.ruled,
      ruling_overrode_raw_tag: row.row.ruledOverride ?? null,
      prompt_delivery_verified: row.row.delivered ?? null,
      clue_leak_check_passed: row.row.leakOk ?? null,
    },
  };
}

export function buildStateMoveReviewArtifacts({ spec, sourceDocuments }) {
  const catalogs = validateSpec(spec);
  const rows = normalizedRows(spec, sourceDocuments, catalogs);
  const selected = stratifiedSelection(spec, rows);
  const cases = selected.map(selectedCase);
  const packet = {
    schema: STATE_MOVE_PACKET_SCHEMA,
    packet_id: spec.packet_id,
    codebook_id: spec.codebook_id,
    purpose:
      'Independent review of the learner state expressed in a public turn and the pedagogical move visibly realized in the following tutor reply.',
    claim_boundary:
      'This packet checks construct recognition and visible tutor conduct. It does not measure learning, transfer, tutor efficacy, or generalization beyond the sampled traces.',
    blinding: {
      excludes: [
        'source world and turn',
        'experimental arm or policy',
        'assigned and gold moves',
        'automated tags and rulings',
        'downstream outcomes',
      ],
      neutral_case_order: true,
    },
    coding_instructions: [
      'Use only the learner turn and tutor reply printed for the case.',
      'Code the learner state expressed in the learner turn, not the state you think the experiment intended to plant.',
      'Code every pedagogical move clearly visible in the tutor reply; do not infer a hidden instruction or arm.',
      'Use an indeterminate disposition whenever the public wording does not support a confident label.',
      'Work independently and do not consult the machine key or another coder before freezing the submission.',
    ],
    cases,
  };
  const machineKey = {
    schema: STATE_MOVE_KEY_SCHEMA,
    packet_id: spec.packet_id,
    warning: 'Do not provide this key to coders before both independent submissions are frozen.',
    sealed_sources: spec.sources.map(({ source_id, file, sha256: digest, provenance }) => ({
      source_id,
      file,
      sha256: digest,
      provenance,
    })),
    sampling: {
      seed: spec.seed,
      dimensions: ['learner state', 'world', 'assignment relation'],
      per_stratum: spec.per_stratum,
      selected_cases: cases.length,
    },
    cases: selected.map((row, index) => machineCase(row, cases[index])),
  };
  return { packet, machineKey };
}

function markdownCell(value) {
  return String(value).replace(/\|/gu, '\\|').replace(/\s+/gu, ' ').trim();
}

export function createStateMoveCodebook(spec) {
  validateSpec(spec);
  const stateRows = spec.states
    .map(
      (entry) =>
        `| \`${entry.code}\` | ${markdownCell(entry.label)} | ${markdownCell(entry.definition)} | ${markdownCell(entry.include.join('; '))} | ${markdownCell(entry.exclude.join('; '))} |`,
    )
    .join('\n');
  const moveRows = spec.moves
    .map(
      (entry) =>
        `| \`${entry.code}\` | ${markdownCell(entry.label)} | ${markdownCell(entry.definition)} | ${markdownCell(entry.include.join('; '))} | ${markdownCell(entry.exclude.join('; '))} |`,
    )
    .join('\n');
  return `# Adaptive state and move review codebook

Codebook: \`${spec.codebook_id}\`

## What to code

For each case, read the learner turn and the tutor reply once as a pair. Code the
learner state from the learner's public words. Then code every pedagogical move
that is clearly visible in the tutor's public reply. Do not guess the hidden
experimental assignment and do not judge whether the learner later improved.

Use \`indeterminate\` when the words support more than one reading and the
ambiguity cannot be resolved from the displayed pair. Give a short reason. An
indeterminate case is retained as indeterminate; it is not a negative label.

## Learner-state labels

| Code | Plain-language name | Meaning | Include | Exclude |
| --- | --- | --- | --- | --- |
${stateRows}
| \`other_state\` | Other visible state | A clear learner state is present but none of the listed constructs fits. | Name the state in notes and cite the wording. | Do not use merely because a listed label feels uncertain; use an indeterminate disposition instead. |

Choose exactly one state when determinate.

## Tutor-move labels

| Code | Plain-language name | Meaning | Include | Exclude |
| --- | --- | --- | --- | --- |
${moveRows}
| \`other_observable\` | Other visible move | A clear pedagogical move is visible but none of the listed constructs fits. | Name the move in notes and cite the wording. | Do not use for an unclear reply; use an indeterminate disposition instead. |
| \`none_observable\` | No listed move visible | The reply contains no clearly realized pedagogical move in this codebook. | Use only when the absence is itself clear. | Do not combine with any other move label. |

Select every move that is clearly realized. Multiple labels are allowed because
a reply can visibly combine moves. \`none_observable\` is exclusive.

## Evidence and independence

- For a determinate state, quote the shortest learner phrase that supports it.
- For determinate moves, quote the shortest tutor phrase or phrases that support them.
- Never use world knowledge, another transcript turn, arm information, automated
  tags, or downstream outcomes.
- Complete the assigned template independently. Do not discuss cases with the
  other coder and do not access the machine key until both files are frozen.
`;
}

function permutedCases(packet, coderId) {
  return [...packet.cases].sort((left, right) =>
    sha256(`${packet.packet_id}\u001f${coderId}\u001f${left.case_id}`).localeCompare(
      sha256(`${packet.packet_id}\u001f${coderId}\u001f${right.case_id}`),
    ),
  );
}

export function createStateMoveSubmissionTemplate(packet, packetSha256, coderId) {
  requireSha256(packetSha256, 'packetSha256');
  requireString(coderId, 'coderId');
  return {
    schema: STATE_MOVE_SUBMISSION_SCHEMA,
    packet_id: packet.packet_id,
    packet_sha256: packetSha256,
    coder_id: coderId,
    independence_attestation: {
      worked_without_other_coder: false,
      did_not_access_machine_key: false,
    },
    cases: permutedCases(packet, coderId).map(({ case_id }) => ({
      case_id,
      state: {
        disposition: 'determinate',
        label: null,
        evidence: '',
        notes: '',
      },
      move: {
        disposition: 'determinate',
        labels: [],
        evidence: '',
        notes: '',
      },
    })),
  };
}

function validateDimensionDisposition(dimension, field, caseId) {
  if (!isRecord(dimension)) fail(`${caseId}.${field} must be an object`);
  if (!DISPOSITIONS.has(dimension.disposition)) {
    fail(`${caseId}.${field}.disposition must be determinate or indeterminate`);
  }
  if (typeof dimension.evidence !== 'string' || typeof dimension.notes !== 'string') {
    fail(`${caseId}.${field}.evidence and notes must be strings`);
  }
  if (dimension.disposition === 'indeterminate' && !dimension.notes.trim()) {
    fail(`${caseId}.${field} indeterminate ruling must explain the uncertainty`);
  }
}

export function validateStateMoveSubmission({ packet, packetSha256, spec, submission }) {
  const catalogs = validateSpec(spec);
  if (submission?.schema !== STATE_MOVE_SUBMISSION_SCHEMA) {
    fail(`submission schema must be ${STATE_MOVE_SUBMISSION_SCHEMA}`);
  }
  if (submission.packet_id !== packet.packet_id) fail('submission packet_id does not match packet');
  if (submission.packet_sha256 !== packetSha256) fail('submission packet_sha256 does not match frozen packet');
  requireString(submission.coder_id, 'submission.coder_id');
  if (
    submission.independence_attestation?.worked_without_other_coder !== true ||
    submission.independence_attestation?.did_not_access_machine_key !== true
  ) {
    fail('submission must attest independent work and no machine-key access');
  }
  if (!Array.isArray(submission.cases)) fail('submission.cases must be an array');
  const packetIds = packet.cases.map((entry) => entry.case_id);
  const submissionIds = submission.cases.map((entry) => entry.case_id);
  if (new Set(submissionIds).size !== submissionIds.length) fail('submission case ids must be unique');
  if (!exactSetEqual(packetIds, submissionIds)) fail('submission must contain every packet case exactly once');

  const stateLabels = new Set([...catalogs.states.keys(), ...SPECIAL_STATE_LABELS]);
  const moveLabels = new Set([...catalogs.moves.keys(), ...SPECIAL_MOVE_LABELS]);
  for (const row of submission.cases) {
    validateDimensionDisposition(row.state, 'state', row.case_id);
    validateDimensionDisposition(row.move, 'move', row.case_id);

    if (row.state.disposition === 'determinate') {
      if (!stateLabels.has(row.state.label)) fail(`${row.case_id}.state.label is not in the codebook`);
      if (!row.state.evidence.trim()) fail(`${row.case_id}.state.evidence is required when determinate`);
    } else if (row.state.label !== null) {
      fail(`${row.case_id}.state.label must be null when indeterminate`);
    }

    if (!Array.isArray(row.move.labels) || new Set(row.move.labels).size !== row.move.labels.length) {
      fail(`${row.case_id}.move.labels must be a unique array`);
    }
    if (row.move.disposition === 'determinate') {
      if (row.move.labels.length === 0) fail(`${row.case_id}.move.labels is required when determinate`);
      const unknown = row.move.labels.filter((label) => !moveLabels.has(label));
      if (unknown.length > 0) fail(`${row.case_id}.move.labels contains unknown labels: ${unknown.join(', ')}`);
      if (row.move.labels.includes('none_observable') && row.move.labels.length > 1) {
        fail(`${row.case_id}.move.none_observable cannot be combined with another label`);
      }
      if (!row.move.evidence.trim()) fail(`${row.case_id}.move.evidence is required when determinate`);
    } else if (row.move.labels.length > 0) {
      fail(`${row.case_id}.move.labels must be empty when indeterminate`);
    }
  }
  return submission;
}

function compareState(rows, machine) {
  const uncertain = rows.filter((row) => row.state.disposition === 'indeterminate').map((row) => row.coder_id);
  const determinate = rows.filter((row) => row.state.disposition === 'determinate');
  const labelsDisagree =
    determinate.length === rows.length && !determinate.every((row) => row.state.label === determinate[0].state.label);
  if (uncertain.length > 0 || labelsDisagree) {
    return {
      status: 'indeterminate',
      reasons: [...(uncertain.length ? ['coder_uncertainty'] : []), ...(labelsDisagree ? ['coder_disagreement'] : [])],
      indeterminate_by: uncertain,
      coder_values: Object.fromEntries(rows.map((row) => [row.coder_id, row.state])),
    };
  }
  const consensus = determinate[0].state.label;
  return {
    status: 'determinate',
    consensus,
    matches_machine_state: consensus === machine.expected_state,
  };
}

function compareMove(rows, machine) {
  const uncertain = rows.filter((row) => row.move.disposition === 'indeterminate').map((row) => row.coder_id);
  const determinate = rows.filter((row) => row.move.disposition === 'determinate');
  const labelsDisagree =
    determinate.length === rows.length &&
    !determinate.every((row) => exactSetEqual(row.move.labels, determinate[0].move.labels));
  if (uncertain.length > 0 || labelsDisagree) {
    return {
      status: 'indeterminate',
      reasons: [...(uncertain.length ? ['coder_uncertainty'] : []), ...(labelsDisagree ? ['coder_disagreement'] : [])],
      indeterminate_by: uncertain,
      coder_values: Object.fromEntries(rows.map((row) => [row.coder_id, row.move])),
    };
  }
  const consensus = [...determinate[0].move.labels].sort();
  const assignedRealized = consensus.includes(machine.assigned_move);
  const goldRealized = consensus.includes(machine.gold_move);
  return {
    status: 'determinate',
    consensus,
    assigned_move_realized: assignedRealized,
    gold_move_realized: goldRealized,
    agrees_with_automated_gold_ruling: goldRealized === machine.automated.ruled_gold_realization,
  };
}

function dimensionSummary(cases, dimension, matchField) {
  const determinate = cases.filter((entry) => entry[dimension].status === 'determinate');
  const indeterminate = cases.filter((entry) => entry[dimension].status === 'indeterminate');
  const matches = matchField ? determinate.filter((entry) => entry[dimension][matchField] === true).length : null;
  return {
    total: cases.length,
    determinate: determinate.length,
    indeterminate: indeterminate.length,
    coder_uncertainty: indeterminate.filter((entry) => entry[dimension].reasons.includes('coder_uncertainty')).length,
    coder_disagreement: indeterminate.filter((entry) => entry[dimension].reasons.includes('coder_disagreement')).length,
    ...(matchField
      ? {
          matches: matches,
          mismatches: determinate.length - matches,
          match_rate_among_determinate: ratio(matches, determinate.length),
        }
      : {}),
  };
}

function moveOutcomeSummary(cases) {
  const determinate = cases.filter((entry) => entry.move.status === 'determinate');
  const assigned = determinate.filter((entry) => entry.move.assigned_move_realized).length;
  const gold = determinate.filter((entry) => entry.move.gold_move_realized).length;
  const automatedAgreement = determinate.filter((entry) => entry.move.agrees_with_automated_gold_ruling).length;
  return {
    determinate: determinate.length,
    indeterminate: cases.length - determinate.length,
    assigned_move_realized: assigned,
    assigned_move_not_realized: determinate.length - assigned,
    assigned_move_realization_rate: ratio(assigned, determinate.length),
    gold_move_realized: gold,
    gold_move_not_realized: determinate.length - gold,
    gold_move_realization_rate: ratio(gold, determinate.length),
    automated_ruling_agreements: automatedAgreement,
    automated_ruling_disagreements: determinate.length - automatedAgreement,
    automated_ruling_agreement_rate: ratio(automatedAgreement, determinate.length),
  };
}

function confusionRows(cases, expectedField, dimension, valueField) {
  const counts = new Map();
  for (const entry of cases) {
    if (entry[dimension].status !== 'determinate') continue;
    const observed = Array.isArray(entry[dimension][valueField])
      ? entry[dimension][valueField].join('+')
      : entry[dimension][valueField];
    const key = `${entry[expectedField]}\u001f${observed}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [expected, observed] = key.split('\u001f');
      return { expected, observed, count };
    })
    .sort((left, right) => left.expected.localeCompare(right.expected) || left.observed.localeCompare(right.observed));
}

function summarizeCases(cases) {
  return {
    total_cases: cases.length,
    fully_determinate_cases: cases.filter(
      (entry) => entry.state.status === 'determinate' && entry.move.status === 'determinate',
    ).length,
    cases_with_any_indeterminate_dimension: cases.filter(
      (entry) => entry.state.status === 'indeterminate' || entry.move.status === 'indeterminate',
    ).length,
    state: dimensionSummary(cases, 'state', 'matches_machine_state'),
    move: dimensionSummary(cases, 'move', 'agrees_with_automated_gold_ruling'),
    move_realization: moveOutcomeSummary(cases),
  };
}

function groupedSummary(cases, field) {
  const groups = new Map();
  for (const entry of cases) {
    const value = entry[field];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(entry);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [key, summarizeCases(rows)]),
  );
}

export function compareStateMoveSubmissions({ packet, packetSha256, spec, machineKey, submissions }) {
  validateSpec(spec);
  requireSha256(packetSha256, 'packetSha256');
  if (machineKey?.schema !== STATE_MOVE_KEY_SCHEMA || machineKey.packet_id !== packet.packet_id) {
    fail('machine key does not match packet');
  }
  if (!Array.isArray(submissions) || submissions.length !== 2) fail('exactly two independent submissions are required');
  const validated = submissions.map((submission) =>
    validateStateMoveSubmission({ packet, packetSha256, spec, submission }),
  );
  const coderIds = validated.map((submission) => submission.coder_id);
  if (new Set(coderIds).size !== coderIds.length) fail('coder ids must be unique');
  const keyByCase = new Map(machineKey.cases.map((entry) => [entry.case_id, entry]));
  if (
    keyByCase.size !== packet.cases.length ||
    !exactSetEqual(
      [...keyByCase.keys()],
      packet.cases.map((entry) => entry.case_id),
    )
  ) {
    fail('machine key must contain every packet case exactly once');
  }
  const byCoder = validated.map((submission) => ({
    coder_id: submission.coder_id,
    by_case: new Map(submission.cases.map((entry) => [entry.case_id, entry])),
  }));
  const cases = packet.cases.map((reviewCase) => {
    const machine = keyByCase.get(reviewCase.case_id);
    const rows = byCoder.map((coder) => ({ coder_id: coder.coder_id, ...coder.by_case.get(reviewCase.case_id) }));
    return {
      case_id: reviewCase.case_id,
      source_id: machine.source_id,
      source_arm: machine.source_locator.arm,
      assignment_relation: machine.assignment_relation,
      expected_state: machine.expected_state,
      assigned_move: machine.assigned_move,
      gold_move: machine.gold_move,
      automated_gold_ruling: machine.automated.ruled_gold_realization,
      state: compareState(rows, machine),
      move: compareMove(rows, machine),
    };
  });

  return {
    schema: STATE_MOVE_REPORT_SCHEMA,
    packet_id: packet.packet_id,
    packet_sha256: packetSha256,
    coder_ids: coderIds,
    summary: summarizeCases(cases),
    by_assignment_relation: groupedSummary(cases, 'assignment_relation'),
    by_arm: groupedSummary(cases, 'source_arm'),
    construct_confusion: {
      state_expected_vs_human: confusionRows(cases, 'expected_state', 'state', 'consensus'),
      assigned_move_vs_human_visible: confusionRows(cases, 'assigned_move', 'move', 'consensus'),
      gold_move_vs_human_visible: confusionRows(cases, 'gold_move', 'move', 'consensus'),
    },
    cases,
  };
}

export function assertPublicArtifactsBlind({ packet, codebook, submissions }) {
  const forbiddenKeys = new Set([
    'world',
    'turn',
    'arm',
    'policy',
    'assigned_move',
    'gold_move',
    'assignment_relation',
    'automated',
    'hit',
    'ruled',
    'ruledOverride',
    'delivered',
    'leakOk',
    'source_id',
    'source_locator',
  ]);
  const visit = (value, location) => {
    if (Array.isArray(value)) return value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) fail(`public artifact leaked private key ${key} at ${location}`);
      visit(child, `${location}.${key}`);
    }
  };
  visit(packet, 'packet');
  for (const submission of submissions) visit(submission, `submission:${submission.coder_id}`);
  const forbiddenSourceTokens = ['world_030_rowan_flat', 'world_033_alder_row_redoubt', 'fixedA', 'fixedB'];
  const publicBytes = `${JSON.stringify(packet)}\n${codebook}\n${JSON.stringify(submissions)}`;
  for (const token of forbiddenSourceTokens) {
    if (publicBytes.includes(token)) fail(`public artifacts leaked private source token ${token}`);
  }
  return true;
}
