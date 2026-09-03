import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH =
  'config/tutor-stub-action-outcome-model-judge-shadow-design.v1.json';
export const TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_REPORT_SCHEMA =
  'machinespirits.tutor-stub.action-outcome-model-judge-shadow-report.v1';

const DELIVERY_LABELS = Object.freeze(['delivered', 'not_delivered', 'indeterminate']);
const OUTCOME_LABELS = Object.freeze(['success', 'failure', 'partial', 'inconclusive', 'measurement_indeterminate']);
const CONFIDENCE_LABELS = Object.freeze(['high', 'medium', 'low']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readBytes(file, expectedSha256, label) {
  const bytes = fs.readFileSync(file);
  const observed = sha256(bytes);
  if (observed !== expectedSha256) throw new Error(`${label} hash mismatch: ${observed}`);
  return bytes;
}

function repositoryRelative(root, value, label) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return relative.split(path.sep).join('/');
}

function exactKeys(value, expected, label, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${label}_object_required`);
    return;
  }
  const observed = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(observed) !== JSON.stringify(wanted)) issues.push(`${label}_keys_not_exact`);
}

export function validateTutorStubActionOutcomeModelJudgeDesign(design) {
  const issues = [];
  if (design?.documentType !== 'prospective_paid_shadow_measurement_design') issues.push('document_type');
  if (design?.revision !== 1) issues.push('revision');
  if (design?.studyId !== 'tutor-stub-action-outcome-model-judge-shadow-v1') issues.push('study_id');
  if (design?.source?.sourceStudyId !== 'tutor-stub-action-outcome-comparable-collection-v2') {
    issues.push('source_study');
  }
  if (design?.source?.packetId !== 'action-outcome-comparable-v2-reconciled-2026-09-02') {
    issues.push('packet_id');
  }
  if (design?.source?.caseCount !== 35) issues.push('case_count');
  for (const key of ['packetSha256', 'machineKeySha256', 'manifestSha256', 'originalCodebookSha256']) {
    if (!/^[0-9a-f]{64}$/u.test(String(design?.source?.[key] || ''))) issues.push(key);
  }
  const expectedSeats = [
    ['judge_sol', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol', 'openai_gpt_5_6', 'low', 2026090211],
    ['judge_opus', 'claude-code.opus-5', 'claude-code', 'claude-opus-5', 'anthropic_claude_5', 'low', 2026090212],
  ];
  const seats = design?.judges?.seats;
  if (
    !Array.isArray(seats) ||
    JSON.stringify(
      seats.map((seat) => [
        seat.id,
        seat.modelRef,
        seat.provider,
        seat.model,
        seat.modelFamily,
        seat.effort,
        seat.orderSeed,
      ]),
    ) !== JSON.stringify(expectedSeats)
  ) {
    issues.push('judge_seats');
  }
  if (design?.judges?.attemptsPerSeatPerCase !== 1 || design?.judges?.automaticRetries !== 0) {
    issues.push('judge_attempts');
  }
  if (
    design?.attemptCeiling?.plannedCalls !== 70 ||
    design?.attemptCeiling?.maximumAttempts !== 70 ||
    design?.attemptCeiling?.maximumAttempts !== design?.source?.caseCount * expectedSeats.length
  ) {
    issues.push('attempt_ceiling');
  }
  const gates = design?.analysis?.diagnosticGates;
  if (gates?.minimumProtocolValidRatePerSeat !== 0.9) issues.push('valid_rate_gate');
  if (gates?.minimumJointExactAgreement !== 0.8) issues.push('agreement_gate');
  if (gates?.maximumPairedMeasurementIndeterminateRate !== 0.2) issues.push('indeterminate_gate');
  if (gates?.minimumExactConsensusBinaryRecords !== 24) issues.push('binary_gate');
  if (gates?.minimumExactConsensusBinaryRecordsPerMoveFamily !== 6) issues.push('family_binary_gate');
  if (design?.launch?.designGrantsModelCalls !== false) issues.push('call_authority');
  if (!String(design?.claimBoundary || '').includes('cannot validate the construct')) issues.push('claim_boundary');
  if (issues.length) throw new Error(`action-outcome model-judge design invalid: ${issues.join(', ')}`);
  return design;
}

export function loadTutorStubActionOutcomeModelJudgeDesign({
  root,
  designPath = TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH,
} = {}) {
  const relativePath = repositoryRelative(root, designPath, 'design path');
  const bytes = fs.readFileSync(path.resolve(root, relativePath));
  const design = validateTutorStubActionOutcomeModelJudgeDesign(JSON.parse(bytes.toString('utf8')));
  const instrumentPath = repositoryRelative(root, design.instrument.path, 'instrument path');
  const instrumentBytes = fs.readFileSync(path.resolve(root, instrumentPath));
  return {
    root,
    relativePath,
    sha256: sha256(bytes),
    design,
    instrumentPath,
    instrumentText: instrumentBytes.toString('utf8'),
    instrumentSha256: sha256(instrumentBytes),
  };
}

export function loadTutorStubActionOutcomeModelJudgeInputs({ loaded, packetRoot }) {
  if (!packetRoot || !path.isAbsolute(packetRoot)) throw new Error('packet root must be absolute');
  const source = loaded.design.source;
  const file = (name) => path.resolve(packetRoot, name);
  const packetBytes = readBytes(file(source.packetFile), source.packetSha256, 'packet');
  const machineKeyBytes = readBytes(file(source.machineKeyFile), source.machineKeySha256, 'machine key');
  readBytes(file(source.manifestFile), source.manifestSha256, 'manifest');
  readBytes(file(source.originalCodebookFile), source.originalCodebookSha256, 'original codebook');
  for (const entry of source.humanSubmissionFiles) {
    readBytes(file(entry.file), entry.sha256, `human submission ${entry.file}`);
  }
  const packet = JSON.parse(packetBytes.toString('utf8'));
  const machineKey = JSON.parse(machineKeyBytes.toString('utf8'));
  if (packet.packetId !== source.packetId || machineKey.packetId !== source.packetId) {
    throw new Error('packet identity mismatch');
  }
  if (machineKey.packetSha256 !== source.packetSha256) throw new Error('machine key packet hash mismatch');
  if (!Array.isArray(packet.cases) || packet.cases.length !== source.caseCount) {
    throw new Error('packet case count mismatch');
  }
  if (!Array.isArray(machineKey.cases) || machineKey.cases.length !== source.caseCount) {
    throw new Error('machine key case count mismatch');
  }
  const packetIds = packet.cases.map((entry) => entry.caseId);
  const keyIds = machineKey.cases.map((entry) => entry.caseId);
  if (new Set(packetIds).size !== source.caseCount || JSON.stringify(packetIds) !== JSON.stringify(keyIds)) {
    throw new Error('packet and machine-key case identities do not match exactly');
  }
  for (const entry of packet.cases) {
    const expected = ['caseId', 'expectedEvidence', 'learnerBefore', 'learnerText', 'requestedAction', 'tutorText'];
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expected.sort())) {
      throw new Error(`public packet fields drifted for ${entry.caseId}`);
    }
  }
  return {
    packetRoot: path.resolve(packetRoot),
    packet,
    machineKey,
    humanSubmissionHashes: Object.fromEntries(source.humanSubmissionFiles.map((entry) => [entry.file, entry.sha256])),
  };
}

function rank(seed, caseId) {
  return sha256(`${seed}\0${caseId}`);
}

export function buildTutorStubActionOutcomeModelJudgePlan({ loaded, inputs, readers }) {
  const keyById = new Map(inputs.machineKey.cases.map((entry) => [entry.caseId, entry]));
  const cases = inputs.packet.cases.map((entry) => {
    const key = keyById.get(entry.caseId);
    return {
      case_id: entry.caseId,
      public_case_sha256: sha256(JSON.stringify(entry)),
      move_family: key?.action?.move_family || null,
      action_type: entry.requestedAction?.type || null,
      world_id: key?.worldId || null,
      public_case: entry,
    };
  });
  if (cases.some((entry) => !entry.move_family || !entry.world_id)) {
    throw new Error('machine key lacks family or world metadata');
  }
  const executionUnits = readers.flatMap((seat) =>
    [...cases]
      .sort((left, right) => rank(seat.orderSeed, left.case_id).localeCompare(rank(seat.orderSeed, right.case_id)))
      .map((caseEntry) => ({ caseEntry, seat })),
  );
  if (executionUnits.length !== loaded.design.attemptCeiling.plannedCalls) {
    throw new Error('model-judge execution plan does not close to planned calls');
  }
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-model-judge-shadow-plan.v1',
    study_id: loaded.design.studyId,
    status: 'passed_zero_call',
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    instrument: { path: loaded.instrumentPath, sha256: loaded.instrumentSha256 },
    source: {
      study_id: loaded.design.source.sourceStudyId,
      packet_id: loaded.design.source.packetId,
      packet_sha256: loaded.design.source.packetSha256,
      machine_key_sha256: loaded.design.source.machineKeySha256,
      original_human_files_unchanged: inputs.humanSubmissionHashes,
    },
    cases: cases.map(({ public_case: _publicCase, ...entry }) => entry),
    readers: readers.map(({ resolved: _resolved, ...seat }) => seat),
    execution_order: executionUnits.map(({ caseEntry, seat }) => `${caseEntry.case_id}/${seat.id}`),
    planned_model_calls: executionUnits.length,
    hard_attempt_ceiling: loaded.design.attemptCeiling.maximumAttempts,
    model_calls_executed: 0,
    claim_boundary: loaded.design.claimBoundary,
    executionUnits,
  };
}

export function buildTutorStubActionOutcomeModelJudgePrompt({ instrumentText, caseEntry }) {
  const outputSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['case_id', 'delivery', 'outcome', 'confidence'],
    properties: {
      case_id: { type: 'string', enum: [caseEntry.case_id] },
      delivery: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'evidence_quote', 'explanation'],
        properties: {
          label: { type: 'string', enum: DELIVERY_LABELS },
          evidence_quote: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1 }] },
          explanation: { type: 'string', minLength: 1 },
        },
      },
      outcome: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'evidence_quote', 'explanation'],
        properties: {
          label: { type: 'string', enum: OUTCOME_LABELS },
          evidence_quote: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1 }] },
          explanation: { type: 'string', minLength: 1 },
        },
      },
      confidence: { type: 'string', enum: CONFIDENCE_LABELS },
    },
  };
  return {
    case_id: caseEntry.case_id,
    public_case_sha256: caseEntry.public_case_sha256,
    system_prompt: instrumentText.trim(),
    user_prompt: JSON.stringify({ case_id: caseEntry.case_id, public_case: caseEntry.public_case }),
    output_schema: outputSchema,
  };
}

function parseJsonObject(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const text = String(raw || '').trim();
  const source = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1] || text;
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

export function evaluateTutorStubActionOutcomeModelJudgeResponse({ response, seat, prompt, publicCase }) {
  const issues = [];
  const output = parseJsonObject(response?.text ?? response);
  exactKeys(output, ['case_id', 'delivery', 'outcome', 'confidence'], 'output', issues);
  exactKeys(output?.delivery, ['label', 'evidence_quote', 'explanation'], 'delivery', issues);
  exactKeys(output?.outcome, ['label', 'evidence_quote', 'explanation'], 'outcome', issues);
  if (output?.case_id !== prompt.case_id) issues.push('case_id');
  if (!DELIVERY_LABELS.includes(output?.delivery?.label)) issues.push('delivery_label');
  if (!OUTCOME_LABELS.includes(output?.outcome?.label)) issues.push('outcome_label');
  if (!CONFIDENCE_LABELS.includes(output?.confidence)) issues.push('confidence');
  if (!String(output?.delivery?.explanation || '').trim()) issues.push('delivery_explanation');
  if (!String(output?.outcome?.explanation || '').trim()) issues.push('outcome_explanation');
  const deliveryQuote = output?.delivery?.evidence_quote;
  if (output?.delivery?.label === 'indeterminate') {
    if (deliveryQuote !== null) issues.push('delivery_indeterminate_quote_must_be_null');
  } else if (!String(deliveryQuote || '') || !String(publicCase.tutorText).includes(String(deliveryQuote))) {
    issues.push('delivery_quote_not_exact');
  }
  const outcomeQuote = output?.outcome?.evidence_quote;
  if (output?.outcome?.label === 'measurement_indeterminate') {
    if (outcomeQuote !== null) issues.push('outcome_indeterminate_quote_must_be_null');
  } else if (!String(outcomeQuote || '') || !String(publicCase.learnerText).includes(String(outcomeQuote))) {
    issues.push('outcome_quote_not_exact');
  }
  if (output?.delivery?.label !== 'delivered' && output?.outcome?.label !== 'measurement_indeterminate') {
    issues.push('undelivered_outcome_must_be_indeterminate');
  }
  if (response && typeof response === 'object' && Object.hasOwn(response, 'text')) {
    if (response.provider !== seat.provider) issues.push('model_provider');
    if (response.model !== seat.model) issues.push('model_id');
    if ((response.effort || response.reasoningEffort) !== seat.effort) issues.push('model_effort');
    if (response.structuredOutput !== true) issues.push('structured_output');
    if (response.prohibitedToolEventCountObserved !== true || response.prohibitedToolEventCount !== 0) {
      issues.push('prohibited_tool_audit');
    }
  }
  const uniqueIssues = [...new Set(issues)];
  return {
    eligible: uniqueIssues.length === 0,
    issues: uniqueIssues,
    delivery: DELIVERY_LABELS.includes(output?.delivery?.label) ? output.delivery : null,
    outcome: OUTCOME_LABELS.includes(output?.outcome?.label) ? output.outcome : null,
    confidence: CONFIDENCE_LABELS.includes(output?.confidence) ? output.confidence : null,
    output,
  };
}

function frequency(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((entry) => entry === value).length]),
  );
}

function agreement(values) {
  const denominator = values.length;
  const numerator = values.filter(([left, right]) => left === right).length;
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

function cohenKappa(values) {
  if (!values.length) return null;
  const labels = [...new Set(values.flat())];
  const observed = values.filter(([left, right]) => left === right).length / values.length;
  const expected = labels.reduce((sum, label) => {
    const left = values.filter((entry) => entry[0] === label).length / values.length;
    const right = values.filter((entry) => entry[1] === label).length / values.length;
    return sum + left * right;
  }, 0);
  if (expected === 1) return observed === 1 ? 1 : null;
  return (observed - expected) / (1 - expected);
}

function groupCount(rows, key) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[key]))]
      .sort()
      .map((value) => [value, rows.filter((row) => row[key] === value).length]),
  );
}

export function summarizeTutorStubActionOutcomeModelJudge({ loaded, plan, records, failures, machineKey }) {
  const seats = loaded.design.judges.seats;
  const recordFor = (caseId, seatId) =>
    records.find((entry) => entry.case_id === caseId && entry.seat_id === seatId) || null;
  const metadata = new Map(machineKey.cases.map((entry) => [entry.caseId, entry]));
  const seatSummary = Object.fromEntries(
    seats.map((seat) => {
      const seatRecords = records.filter((entry) => entry.seat_id === seat.id);
      const eligible = seatRecords.filter((entry) => entry.measurement.eligible).length;
      return [
        seat.id,
        {
          model_ref: seat.modelRef,
          completed: seatRecords.length,
          eligible,
          failed: failures.filter((entry) => entry.seat_id === seat.id).length,
          missing:
            plan.cases.length - seatRecords.length - failures.filter((entry) => entry.seat_id === seat.id).length,
          eligible_rate: eligible / plan.cases.length,
          delivery_labels: frequency(
            seatRecords.filter((entry) => entry.measurement.eligible).map((entry) => entry.measurement.delivery.label),
          ),
          outcome_labels: frequency(
            seatRecords.filter((entry) => entry.measurement.eligible).map((entry) => entry.measurement.outcome.label),
          ),
        },
      ];
    }),
  );
  const rows = plan.cases.map((caseEntry) => {
    const left = recordFor(caseEntry.case_id, seats[0].id);
    const right = recordFor(caseEntry.case_id, seats[1].id);
    const bothEligible = left?.measurement?.eligible === true && right?.measurement?.eligible === true;
    const deliveryExact = bothEligible && left.measurement.delivery.label === right.measurement.delivery.label;
    const outcomeExact = bothEligible && left.measurement.outcome.label === right.measurement.outcome.label;
    const jointExact = deliveryExact && outcomeExact;
    const key = metadata.get(caseEntry.case_id);
    let disposition = 'measurement_indeterminate';
    let delivery = null;
    let outcome = null;
    if (jointExact) {
      delivery = left.measurement.delivery.label;
      outcome = left.measurement.outcome.label;
      disposition = outcome;
    }
    const binary = jointExact && delivery === 'delivered' && ['success', 'failure'].includes(outcome);
    return {
      case_id: caseEntry.case_id,
      move_family: key.action.move_family,
      action_type: key.action.action_type,
      world_id: key.worldId,
      both_eligible: bothEligible,
      delivery_exact: deliveryExact,
      outcome_exact: outcomeExact,
      joint_exact: jointExact,
      consensus: { disposition, delivery, outcome, binary },
      frozen_auxiliary: {
        delivery_visible: key.auxiliaryDeliveryVisible,
        outcome: key.auxiliaryOutcome,
      },
      votes: Object.fromEntries(
        seats.map((seat) => {
          const record = recordFor(caseEntry.case_id, seat.id);
          return [
            seat.id,
            record
              ? {
                  eligible: record.measurement.eligible,
                  issues: record.measurement.issues,
                  delivery: record.measurement.delivery,
                  outcome: record.measurement.outcome,
                  confidence: record.measurement.confidence,
                }
              : null,
          ];
        }),
      ),
    };
  });
  const eligiblePairs = rows.filter((row) => row.both_eligible);
  const deliveryPairs = eligiblePairs.map((row) => [
    row.votes[seats[0].id].delivery.label,
    row.votes[seats[1].id].delivery.label,
  ]);
  const outcomePairs = eligiblePairs.map((row) => [
    row.votes[seats[0].id].outcome.label,
    row.votes[seats[1].id].outcome.label,
  ]);
  const jointPairs = eligiblePairs.map((row) => [
    `${row.votes[seats[0].id].delivery.label}|${row.votes[seats[0].id].outcome.label}`,
    `${row.votes[seats[1].id].delivery.label}|${row.votes[seats[1].id].outcome.label}`,
  ]);
  const binaryRows = rows.filter((row) => row.consensus.binary);
  const pairedIndeterminate = rows.filter((row) => row.consensus.disposition === 'measurement_indeterminate').length;
  const gates = loaded.design.analysis.diagnosticGates;
  const checks = {
    protocol_valid_rate_per_seat: {
      observed: Object.fromEntries(Object.entries(seatSummary).map(([id, entry]) => [id, entry.eligible_rate])),
      threshold: gates.minimumProtocolValidRatePerSeat,
      pass: Object.values(seatSummary).every((entry) => entry.eligible_rate >= gates.minimumProtocolValidRatePerSeat),
    },
    joint_exact_agreement: {
      observed: agreement(jointPairs).rate,
      threshold: gates.minimumJointExactAgreement,
      pass: agreement(jointPairs).rate !== null && agreement(jointPairs).rate >= gates.minimumJointExactAgreement,
    },
    paired_measurement_indeterminate_rate: {
      observed: pairedIndeterminate / rows.length,
      threshold: gates.maximumPairedMeasurementIndeterminateRate,
      pass: pairedIndeterminate / rows.length <= gates.maximumPairedMeasurementIndeterminateRate,
    },
    exact_consensus_binary_records: {
      observed: binaryRows.length,
      threshold: gates.minimumExactConsensusBinaryRecords,
      pass: binaryRows.length >= gates.minimumExactConsensusBinaryRecords,
    },
    exact_consensus_binary_records_per_move_family: {
      observed: groupCount(binaryRows, 'move_family'),
      threshold: gates.minimumExactConsensusBinaryRecordsPerMoveFamily,
      pass: ['explain_model', 'minimal_support', 'request_self_explanation'].every(
        (family) =>
          binaryRows.filter((row) => row.move_family === family).length >=
          gates.minimumExactConsensusBinaryRecordsPerMoveFamily,
      ),
    },
  };
  const auxiliaryBinaryRows = binaryRows.filter((row) => ['success', 'failure'].includes(row.frozen_auxiliary.outcome));
  const allPass = Object.values(checks).every((entry) => entry.pass);
  return {
    schema: TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_REPORT_SCHEMA,
    study_id: loaded.design.studyId,
    status: allPass ? 'exploratory_model_pair_pass' : 'exploratory_model_pair_failed',
    source_study_id: loaded.design.source.sourceStudyId,
    claim_boundary: loaded.design.claimBoundary,
    human_gate_status: 'unchanged_pending_human_review',
    controller_study_licensed: false,
    seats: seatSummary,
    agreement: {
      paired_protocol_valid_cases: eligiblePairs.length,
      delivery: { exact: agreement(deliveryPairs), cohen_kappa: cohenKappa(deliveryPairs) },
      outcome: { exact: agreement(outcomePairs), cohen_kappa: cohenKappa(outcomePairs) },
      joint: { exact: agreement(jointPairs), cohen_kappa: cohenKappa(jointPairs) },
    },
    yield: {
      cases: rows.length,
      paired_measurement_indeterminate: pairedIndeterminate,
      paired_measurement_indeterminate_rate: pairedIndeterminate / rows.length,
      exact_consensus_binary_records: binaryRows.length,
      exact_consensus_binary_by_family: groupCount(binaryRows, 'move_family'),
      exact_consensus_binary_by_world: groupCount(binaryRows, 'world_id'),
      exact_consensus_binary_outcomes: Object.fromEntries(
        ['success', 'failure'].map((label) => [
          label,
          binaryRows.filter((row) => row.consensus.outcome === label).length,
        ]),
      ),
    },
    frozen_auxiliary_comparison: {
      binary_overlap: auxiliaryBinaryRows.length,
      same_binary: auxiliaryBinaryRows.filter((row) => row.consensus.outcome === row.frozen_auxiliary.outcome).length,
      opposite_binary: auxiliaryBinaryRows.filter((row) => row.consensus.outcome !== row.frozen_auxiliary.outcome)
        .length,
      nonconfirmatory_auxiliary: binaryRows.filter(
        (row) => !['success', 'failure'].includes(row.frozen_auxiliary.outcome),
      ).length,
    },
    diagnostic_checks: checks,
    disagreements: rows.filter((row) => !row.joint_exact),
    rows,
  };
}

function percent(value) {
  return value === null || value === undefined ? 'n/a' : `${(100 * value).toFixed(1)}%`;
}

export function renderTutorStubActionOutcomeModelJudgeReport(report) {
  const lines = [
    '# Action-outcome Opus-Sol shadow judgment',
    '',
    `**Verdict: ${report.status}. The registered human gates remain pending and the controller study is not licensed.**`,
    '',
    `Both model seats produced protocol-valid judgments for ${report.agreement.paired_protocol_valid_cases}/${report.yield.cases} cases. Joint delivery-plus-outcome exact agreement was ${percent(report.agreement.joint.exact.rate)} (Cohen kappa ${report.agreement.joint.cohen_kappa?.toFixed(3) ?? 'n/a'}).`,
    '',
    `The pair produced ${report.yield.exact_consensus_binary_records} exact-consensus binary records. Paired measurement indeterminacy was ${report.yield.paired_measurement_indeterminate}/${report.yield.cases} (${percent(report.yield.paired_measurement_indeterminate_rate)}).`,
    '',
    '## Agreement',
    '',
    '| Measure | Exact | Cohen kappa |',
    '|---|---:|---:|',
    `| Delivery | ${percent(report.agreement.delivery.exact.rate)} | ${report.agreement.delivery.cohen_kappa?.toFixed(3) ?? 'n/a'} |`,
    `| Outcome | ${percent(report.agreement.outcome.exact.rate)} | ${report.agreement.outcome.cohen_kappa?.toFixed(3) ?? 'n/a'} |`,
    `| Joint delivery + outcome | ${percent(report.agreement.joint.exact.rate)} | ${report.agreement.joint.cohen_kappa?.toFixed(3) ?? 'n/a'} |`,
    '',
    '## Diagnostic checks',
    '',
    '| Check | Observed | Threshold | Pass |',
    '|---|---:|---:|:---:|',
  ];
  for (const [id, check] of Object.entries(report.diagnostic_checks)) {
    lines.push(
      `| ${id} | ${typeof check.observed === 'number' ? String(check.observed) : JSON.stringify(check.observed)} | ${check.threshold} | ${check.pass ? 'PASS' : 'FAIL'} |`,
    );
  }
  lines.push(
    '',
    '## Claim boundary',
    '',
    report.claim_boundary,
    '',
    "This is a shadow model-measurement result. It neither populates the two human submission files nor changes the source study's registered review verdict.",
    '',
  );
  return lines.join('\n');
}
