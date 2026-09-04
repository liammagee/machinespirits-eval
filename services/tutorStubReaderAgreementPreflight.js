import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { dispatchTutorStubCliBridgeRequest } from './tutorStubCliRequest.js';
import {
  TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1,
  TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1,
  TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1,
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubResistantLearnerReaderGates,
  tutorStubFrameRefuserDepthArmDesign,
  tutorStubFrameRefuserSatisfiableArmDesign,
  tutorStubResistantLearnerMergedFaceDesign,
} from './tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerFinalHorizonPacket,
  createTutorStubResistantLearnerSemanticRuntime,
} from './tutorStubResistantLearnerSemanticRuntime.js';

/**
 * Offline reader-agreement preflight.
 *
 * Every calibration of the resistant-learner family gates on three reader
 * numbers: determinate endpoints, eligible votes per seat, and endpoint
 * agreement across the panel. The agreement rule is the one the design
 * registers: a floor on every seat pair (depth, satisfiable) or the modal
 * rule with a mean-agreement backstop (merged). Each is a property of the
 * reader panel and the transcripts it reads. This module runs the registered panel over archived
 * calibration transcripts through the SAME runtime the live gate uses
 * (createTutorStubResistantLearnerSemanticRuntime -> adjudicateFinalHorizon)
 * and scores the rows with the SAME helper the live summarizers call
 * (summarizeTutorStubResistantLearnerReaderGates). It makes reader calls only:
 * no tutor call, no learner call, no persona call.
 *
 * What it cannot see: tutor non-delivery, learner noncompliance, execution
 * accounting. Those gates need a live run and are listed in the report as
 * unchecked, never as passed.
 */

export const TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_REPORT_SCHEMA =
  'machinespirits.tutor-stub.reader-agreement-preflight-report.v1';

export const TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_LIVE_ONLY_GATES = Object.freeze([
  'execution_and_typed_failure_accounting',
  'treatment_delivery_rate',
  'treatment_any_adjudicated_delivery',
  'treatment_bridge_read_bound',
  'no_confirmed_prohibited_delivery',
  'jurisdiction_retained',
]);

const ARM_IDS = Object.freeze(['treatment', 'reference']);
const FACE_IDS = Object.freeze(['faceA', 'faceB']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function oneEvent(events, predicate, label) {
  const matches = events.filter(predicate);
  if (matches.length !== 1) throw new Error(`${label}: expected one trace event, found ${matches.length}`);
  return matches[0];
}

/**
 * Project the loaded design onto the face the readers run on. Depth and
 * satisfiable designs need an arm; the merged design needs a face. The
 * runtime study code follows the projected face: faceA is B1, faceB is R1,
 * exactly as configureB1/configureR1 set it on a live job.
 */
export function resolveTutorStubReaderPreflightScope({ design, arm = null, face = null, root = process.cwd() }) {
  const schema = design?.schema;
  if (schema === TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1) {
    if (!ARM_IDS.includes(arm)) throw new Error('the depth design needs --arm treatment or --arm reference');
    if (face) throw new Error('--face does not apply to the depth design');
    const faceDesign = tutorStubFrameRefuserDepthArmDesign(design, arm, { root });
    return { kind: 'depth', arm, face: faceDesign.mergedFaceId, studyCode: 'R1', faceDesign };
  }
  if (schema === TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1) {
    if (!ARM_IDS.includes(arm)) throw new Error('the satisfiable design needs --arm treatment or --arm reference');
    if (face) throw new Error('--face does not apply to the satisfiable design');
    const faceDesign = tutorStubFrameRefuserSatisfiableArmDesign(design, arm, { root });
    return { kind: 'satisfiable', arm, face: faceDesign.mergedFaceId, studyCode: 'R1', faceDesign };
  }
  if (schema === TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1) {
    if (!FACE_IDS.includes(face)) throw new Error('the merged design needs --face faceA or --face faceB');
    if (arm) throw new Error('--arm does not apply to the merged design');
    const faceDesign = tutorStubResistantLearnerMergedFaceDesign(design, face);
    return { kind: 'merged', arm: null, face, studyCode: face === 'faceA' ? 'B1' : 'R1', faceDesign };
  }
  throw new Error(`reader preflight does not know design schema ${JSON.stringify(schema)}`);
}

/**
 * Rebuild the public packet of every completed row in one or more archived
 * calibration runs. A run directory holds report.json (rows), jobs/<id>/
 * transcript.json and the trace file each row names. The packet is rebuilt
 * with the live builder, so a reader sees byte-identical text to what the
 * live gate showed. Rows are filtered to the requested arm and study code,
 * because the live floors apply per arm.
 */
export function loadTutorStubArchivedCalibrationCorpus({
  runDirectories,
  archiveRoot = null,
  arm = null,
  face = null,
  studyCode,
  endpointField,
}) {
  if (!Array.isArray(runDirectories) || runDirectories.length === 0) {
    throw new Error('reader preflight needs at least one archived run directory');
  }
  if (!endpointField) throw new Error('reader preflight needs the registered endpoint field');
  const runs = [];
  const cases = [];
  for (const directory of runDirectories) {
    const absoluteRoot = path.isAbsolute(directory)
      ? directory
      : archiveRoot
        ? path.join(archiveRoot, directory)
        : path.resolve(directory);
    const reportPath = path.join(absoluteRoot, 'report.json');
    if (!fs.existsSync(reportPath)) throw new Error(`archived run has no report.json: ${absoluteRoot}`);
    const reportBytes = fs.readFileSync(reportPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const selected = rows.filter(
      (row) =>
        row.status === 'complete' &&
        row.outcome?.primary &&
        (arm === null || row.job?.arm_id === arm) &&
        (face === null || (row.job?.face_id ?? null) === null || row.job.face_id === face) &&
        (!studyCode || row.job?.study === studyCode),
    );
    runs.push({
      directory: absoluteRoot,
      report_sha256: sha256(reportBytes),
      source_commit: report.execution?.source_commit || null,
      rows_total: rows.length,
      rows_complete: rows.filter((row) => row.status === 'complete').length,
      rows_selected: selected.length,
    });
    for (const row of selected) {
      const jobId = row.job.id;
      const transcriptPath = path.join(absoluteRoot, row.transcript || path.join('jobs', jobId, 'transcript.json'));
      const tracePath = path.join(absoluteRoot, row.trace);
      const transcriptBytes = fs.readFileSync(transcriptPath);
      const traceBytes = fs.readFileSync(tracePath);
      const transcript = JSON.parse(transcriptBytes.toString('utf8'));
      const events = readJsonLines(tracePath);
      const intervention = oneEvent(
        events,
        (event) => event.type === 'resistance_action_register_intervention_applied' && event.jobId === jobId,
        `${jobId} intervention`,
      );
      const triggerTurn = Number(intervention.turn);
      const horizon = Number(row.job.outcome_horizon_learner_turns);
      const outcome = oneEvent(
        events,
        (event) =>
          event.type === 'resistance_action_register_outcome_learner_turn' &&
          event.jobId === jobId &&
          Number(event.turn) === triggerTurn + horizon,
        `${jobId} final public learner outcome`,
      );
      const learnerText = String(outcome.learnerText || '');
      if (!learnerText.trim()) throw new Error(`${jobId} lacks its final public learner turn`);
      const turns = transcript.turns;
      const publicPacket = buildTutorStubResistantLearnerFinalHorizonPacket(
        { turns, resistanceActionRegisterStudy: { trigger_turn: triggerTurn, outcome_horizon_learner_turns: horizon } },
        learnerText,
      );
      const archivedEndpoint = row.outcome.primary.fields?.[endpointField] || null;
      cases.push({
        case_id: jobId,
        run_directory: absoluteRoot,
        arm_id: row.job.arm_id ?? null,
        face_id: row.job.face_id ?? null,
        study: row.job.study ?? null,
        world: row.job.world ?? null,
        register: row.job.register ?? null,
        trigger_turn: triggerTurn,
        outcome_horizon_learner_turns: horizon,
        turns,
        learner_text: learnerText,
        public_packet: publicPacket,
        packet_sha256: sha256(canonical(publicPacket)),
        source_sha256: sha256(Buffer.concat([transcriptBytes, traceBytes])),
        archived: {
          endpoint_field: endpointField,
          endpoint_status: archivedEndpoint?.status ?? null,
          endpoint_value: archivedEndpoint?.value ?? null,
          seats: Object.fromEntries(
            (row.outcome.primary.seats || []).map((seat) => [
              seat.judge_id,
              {
                model_ref: seat.model_ref ?? null,
                value: seat.validation?.fields?.[endpointField]?.value ?? null,
                eligible: seat.validation?.fields?.[endpointField]?.eligible === true,
              },
            ]),
          ),
        },
      });
    }
  }
  return { runs, cases };
}

/**
 * A reader-only transport: every call goes through the CLI bridge with the
 * same request shape the live runtime sends, counted against a hard ceiling
 * so a runaway retry loop cannot spend past the plan.
 */
export function createTutorStubReaderPreflightTransport({ callBridge, attemptCeiling }) {
  if (typeof callBridge !== 'function') throw new Error('reader preflight transport needs a bridge caller');
  let attempts = 0;
  async function callPromptModel({
    prompt,
    messageHistory = [],
    resolved,
    systemPrompt,
    role,
    maxTokens,
    trace,
    cliEffort,
    effort,
    outputSchema,
    turn,
    signal,
  }) {
    if (attempts >= attemptCeiling) throw new Error('reader preflight attempt ceiling exhausted before model call');
    attempts += 1;
    const startedAt = new Date().toISOString();
    const result = await dispatchTutorStubCliBridgeRequest(callBridge, {
      resolved,
      systemPrompt,
      userPrompt: prompt,
      role,
      messageHistory,
      effort: effort || cliEffort,
      outputSchema,
      signal,
    });
    const response = {
      text: result.text,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: {
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
        cost: result.cost || 0,
      },
      effort: result.effort || result.reasoningEffort || null,
      reasoningEffort: result.reasoningEffort || result.effort || null,
      structuredOutput: result.structuredOutput === true,
      prohibitedToolEventCount: Number(result.prohibitedToolEventCount || 0),
      prohibitedToolEventCountObserved:
        Object.hasOwn(result, 'prohibitedToolEventCount') && Number.isInteger(result.prohibitedToolEventCount),
    };
    if (Array.isArray(trace)) {
      trace.push({
        type: 'model_call',
        role,
        turn,
        startedAt,
        attempt: attempts,
        provider: response.provider,
        model: response.model,
        effort: response.effort,
        maxTokens,
        latencyMs: response.latencyMs,
        usage: response.usage,
        structuredOutput: response.structuredOutput,
      });
    }
    return response;
  }
  return {
    callPromptModel,
    attempts: () => attempts,
  };
}

async function mapConcurrent(items, parallelism, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(parallelism, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function seatVotes(outcome, endpointField) {
  return Object.fromEntries(
    (outcome?.primary?.seats || []).map((seat) => [
      seat.judge_id,
      {
        model_ref: seat.model_ref ?? null,
        value: seat.validation?.fields?.[endpointField]?.value ?? null,
        eligible: seat.validation?.fields?.[endpointField]?.eligible === true,
      },
    ]),
  );
}

/**
 * Read every case with the registered panel and score the rows with the live
 * gate helper. `callPromptModel` is injected so tests run with no model; the
 * script injects the CLI-bridge transport above.
 */
export async function runTutorStubReaderAgreementPreflight({
  scope,
  cases,
  callPromptModel,
  resolveModel,
  parallelism = 2,
  onCase = () => {},
}) {
  const { faceDesign, studyCode } = scope;
  const endpointField = faceDesign.measurement.endpointField;
  const readerIds = faceDesign.models.finalSemanticReaders.map((reader) => reader.id);
  const rows = await mapConcurrent(cases, parallelism, async (entry) => {
    const trace = [];
    const runtime = createTutorStubResistantLearnerSemanticRuntime({
      appendTraceEvent(target, event) {
        target.push(event);
      },
      callPromptModel,
      resolveModel,
    });
    const state = {
      trace,
      interim: null,
      turns: entry.turns,
      resistanceActionRegisterStudy: {
        resistant_learner_calibration: true,
        resistant_learner_study: studyCode,
        design: faceDesign,
        job_id: entry.case_id,
        trigger_turn: entry.trigger_turn,
        outcome_horizon_learner_turns: entry.outcome_horizon_learner_turns,
      },
    };
    let outcome = null;
    let error = null;
    try {
      outcome = await runtime.adjudicateFinalHorizon({
        state,
        turnNumber: entry.trigger_turn + entry.outcome_horizon_learner_turns,
        learnerText: entry.learner_text,
      });
    } catch (caught) {
      error = caught?.message || String(caught);
    }
    const readerEvents = trace.filter((event) => event.type === 'resistant_learner_semantic_reader_result');
    const row = {
      job: {
        id: entry.case_id,
        arm_id: entry.arm_id,
        face_id: entry.face_id,
        study: entry.study,
        world: entry.world,
        register: entry.register,
      },
      status: outcome ? 'complete' : 'reader_error',
      error,
      packet_sha256: entry.packet_sha256,
      source_sha256: entry.source_sha256,
      outcome,
      reader_calls: readerEvents.length,
      transport_failures: readerEvents.filter((event) => event.transportCompleted === false).length,
      invalid_envelopes: readerEvents.filter(
        (event) => event.transportCompleted === true && event.validModelEnvelope !== true,
      ).length,
      archived: entry.archived,
    };
    onCase(row);
    return row;
  });
  const reader = summarizeTutorStubResistantLearnerReaderGates({ rows, faceDesign });
  const readerErrors = rows.filter((row) => row.status === 'reader_error');
  const transportFailures = rows.reduce((sum, row) => sum + row.transport_failures, 0);
  const comparison = rows
    .filter((row) => row.status === 'complete')
    .map((row) => {
      const fresh = row.outcome?.primary?.fields?.[endpointField] || null;
      return {
        case_id: row.job.id,
        arm_id: row.job.arm_id,
        archived_endpoint: row.archived?.endpoint_value ?? null,
        archived_status: row.archived?.endpoint_status ?? null,
        fresh_endpoint: fresh?.value ?? null,
        fresh_status: fresh?.status ?? null,
        archived_seats: row.archived?.seats || {},
        fresh_seats: seatVotes(row.outcome, endpointField),
      };
    });
  const bothDeterminate = comparison.filter(
    (entry) => entry.archived_status === 'determinate' && entry.fresh_status === 'determinate',
  );
  const gatesPassed = Object.values(reader.gates).every(Boolean);
  // A seat the transport never reached is not a reader vote. The live gate
  // would count it as ineligible; here it makes the verdict incomplete so a
  // bridge outage never reads as reader disagreement.
  const status = readerErrors.length > 0 || transportFailures > 0 ? 'incomplete' : gatesPassed ? 'passed' : 'failed';
  return {
    status,
    gates: reader.gates,
    agreement_rule: reader.agreement_rule,
    floors: reader.floors,
    statistics: {
      cases: rows.length,
      completed: reader.completed.length,
      reader_errors: readerErrors.length,
      reader_calls: rows.reduce((sum, row) => sum + row.reader_calls, 0),
      transport_failures: transportFailures,
      invalid_envelopes: rows.reduce((sum, row) => sum + row.invalid_envelopes, 0),
      determinate: reader.determinate.length,
      determinate_minimum: reader.determinate_minimum,
      rung_counts: reader.rung_counts,
      seat_minimum: reader.seat_minimum,
      endpoint_pairs: reader.endpoint_pairs,
      endpoint_panel: {
        cases_with_at_least_two_eligible_votes: reader.agreement.endpoint_panel.cases_with_at_least_two_eligible_votes,
        mean_pairwise_exact_agreement: reader.agreement.endpoint_panel.mean_pairwise_exact_agreement,
      },
      seat_eligibility: reader.agreement.seat_eligibility,
      archived_comparison: {
        both_determinate: bothDeterminate.length,
        same_endpoint: bothDeterminate.filter((entry) => entry.archived_endpoint === entry.fresh_endpoint).length,
      },
    },
    readers: readerIds,
    agreement: reader.agreement,
    comparison,
    rows,
  };
}

function ratio(numerator, denominator) {
  return denominator ? (numerator / denominator).toFixed(3) : 'n/a';
}

export function renderTutorStubReaderAgreementPreflightMarkdown(report) {
  const lines = [];
  const { statistics: s, gates, floors } = report;
  lines.push(`# Reader-agreement preflight: ${report.status.toUpperCase()}`);
  lines.push('');
  lines.push(
    `Design: ${report.design.path} (sha256 ${report.design.sha256.slice(0, 12)}…, revision ${report.design.revision})`,
  );
  lines.push(
    `Scope: ${report.scope.kind} ${report.scope.arm || report.scope.face}, study code ${report.scope.study_code}, endpoint ${report.scope.endpoint_field}`,
  );
  lines.push(`Reader protocol: ${report.scope.protocol_source}`);
  lines.push(
    `Readers: ${report.readers.map((reader) => `${reader.id}=${reader.modelRef} (${reader.effort})`).join(', ')}`,
  );
  lines.push(
    `Corpus: ${s.cases} completed rows from ${report.corpus.runs.length} archived run(s); reader calls ${s.reader_calls}; live calls 0`,
  );
  lines.push('');
  lines.push('| Gate | Observed | Floor | Result |');
  lines.push('|---|---|---|---|');
  const verdict = (value) => (value ? 'pass' : 'FAIL');
  const modal = report.agreement_rule === 'modal_backstop';
  const determinacyName = modal ? 'primary_endpoint_determinacy' : 'determinate_outcome';
  lines.push(
    `| ${determinacyName} | ${s.determinate}/${s.completed} | ${s.determinate_minimum} (rate ${floors.minimum_determinate_outcome_rate}, floor ${floors.minimum_determinate_outcome_floor}) | ${verdict(gates[determinacyName])} |`,
  );
  const seatText = Object.entries(s.seat_eligibility)
    .map(([id, seat]) => `${id} ${seat.primary}${seat.fidelity === null ? '' : `/${seat.fidelity}`}`)
    .join(', ');
  const pairText = s.endpoint_pairs
    .map(
      (pair) =>
        `${pair.readers.join('×')} ${pair.exact_agreements}/${pair.jointly_eligible}=${ratio(pair.exact_agreements, pair.jointly_eligible)}`,
    )
    .join('; ');
  if (modal) {
    // The merged design gates on the modal rule; per-seat eligibility and the
    // pair breakdown are reported under it, not gated.
    const panel = s.endpoint_panel;
    const mean = panel.mean_pairwise_exact_agreement === null ? 'n/a' : panel.mean_pairwise_exact_agreement.toFixed(3);
    lines.push(
      `| primary_endpoint_reader_eligibility_and_validity_backstop | ${panel.cases_with_at_least_two_eligible_votes}/${s.completed} cases with two eligible votes; mean pairwise ${mean} | ${floors.minimum_cases_with_at_least_two_eligible_endpoint_votes} cases; mean ${floors.minimum_mean_pairwise_exact_agreement_backstop} | ${verdict(gates.primary_endpoint_reader_eligibility_and_validity_backstop)} |`,
    );
    lines.push('');
    lines.push(`Report only under the modal rule: eligible votes per seat ${seatText}; pairs ${pairText}.`);
  } else {
    lines.push(
      `| eligible_vote_rate_per_seat_and_instrument | ${seatText} | ${s.seat_minimum} per seat | ${verdict(gates.eligible_vote_rate_per_seat_and_instrument)} |`,
    );
    if (report.agreement_rule === 'per_pair_floor') {
      lines.push(
        `| pairwise_exact_endpoint_agreement | ${pairText} | ${floors.minimum_pairwise_exact_endpoint_agreement} on every pair | ${verdict(gates.pairwise_exact_endpoint_agreement)} |`,
      );
    } else {
      lines.push(
        `| reader_agreement | ${pairText} | registered per-pair conditional floor | ${verdict(gates.reader_agreement)} |`,
      );
    }
  }
  lines.push('');
  lines.push(`Rung counts over determinate rows: ${JSON.stringify(s.rung_counts)}`);
  lines.push(
    `Archived vs fresh endpoint: ${s.archived_comparison.same_endpoint}/${s.archived_comparison.both_determinate} rows determinate in both reads carry the same rung.`,
  );
  if (s.reader_errors > 0)
    lines.push(`Reader errors: ${s.reader_errors} case(s) produced no outcome; the verdict is incomplete.`);
  if (s.transport_failures > 0) {
    lines.push(
      `Transport failures: ${s.transport_failures} seat read(s) never reached the model; the verdict is incomplete.`,
    );
  }
  lines.push('');
  lines.push(`Not checked here (live run only): ${report.live_only_gates_not_checked.join(', ')}.`);
  lines.push('');
  lines.push('| Case | Arm | Archived | Fresh | Fresh seats |');
  lines.push('|---|---|---|---|---|');
  for (const entry of report.comparison) {
    const seats = Object.entries(entry.fresh_seats)
      .map(([id, seat]) => `${id}=${seat.eligible ? seat.value : `(${seat.value ?? '-'})`}`)
      .join(' ');
    lines.push(
      `| ${entry.case_id} | ${entry.arm_id ?? '-'} | ${entry.archived_status === 'determinate' ? entry.archived_endpoint : 'indet.'} | ${entry.fresh_status === 'determinate' ? entry.fresh_endpoint : 'indet.'} | ${seats} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/**
 * Whole-run entry used by the script: load the design, project the scope,
 * load the corpus, read it, and shape the report. `callPromptModel` null
 * means a dry run: the plan is returned with zero calls made.
 */
export async function executeTutorStubReaderAgreementPreflight({
  designPath,
  arm = null,
  face = null,
  runDirectories,
  archiveRoot = null,
  root = process.cwd(),
  callPromptModel = null,
  resolveModel,
  parallelism = 2,
  onCase,
}) {
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root });
  const scope = resolveTutorStubReaderPreflightScope({ design: loaded.design, arm, face, root });
  const corpus = loadTutorStubArchivedCalibrationCorpus({
    runDirectories,
    archiveRoot,
    arm: scope.arm,
    face: scope.kind === 'merged' ? scope.face : null,
    studyCode: scope.studyCode,
    endpointField: scope.faceDesign.measurement.endpointField,
  });
  const readers = scope.faceDesign.models.finalSemanticReaders.map((reader) => ({
    id: reader.id,
    modelRef: reader.modelRef,
    effort: reader.effort,
  }));
  const fidelityJudges =
    scope.faceDesign.measurement.readerPanel.fidelityJudges || readers.map((reader) => reader.modelRef);
  const plannedCalls = corpus.cases.length * (readers.length + fidelityJudges.length);
  const base = {
    schema: TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_REPORT_SCHEMA,
    generated_at: new Date().toISOString(),
    design: {
      path: path.relative(root, loaded.path),
      sha256: loaded.sha256,
      schema: loaded.design.schema,
      revision: loaded.design.revision ?? null,
      study_id: loaded.design.studyId ?? null,
    },
    scope: {
      kind: scope.kind,
      arm: scope.arm,
      face: scope.face,
      study_code: scope.studyCode,
      endpoint_field: scope.faceDesign.measurement.endpointField,
      protocol_source: scope.faceDesign.measurement.readerPanel.protocolSource,
    },
    readers,
    corpus: { runs: corpus.runs, cases: corpus.cases.length, planned_reader_calls: plannedCalls, live_calls: 0 },
    live_only_gates_not_checked: [...TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_LIVE_ONLY_GATES],
  };
  if (!callPromptModel) {
    return {
      ...base,
      status: 'dry_run',
      cases: corpus.cases.map((entry) => ({
        case_id: entry.case_id,
        arm_id: entry.arm_id,
        packet_sha256: entry.packet_sha256,
        archived_endpoint: entry.archived.endpoint_value,
        archived_status: entry.archived.endpoint_status,
      })),
    };
  }
  const result = await runTutorStubReaderAgreementPreflight({
    scope,
    cases: corpus.cases,
    callPromptModel,
    resolveModel,
    parallelism,
    onCase,
  });
  return { ...base, ...result, readers };
}
