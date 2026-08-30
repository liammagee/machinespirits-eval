import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const TUTOR_STUB_FRAME_REFUSER_NARROWING_DESIGN_SCHEMA_V1 =
  'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-design.v1';
export const TUTOR_STUB_FRAME_REFUSER_NARROWING_PLAN_SCHEMA_V1 =
  'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-plan.v1';
export const TUTOR_STUB_FRAME_REFUSER_NARROWING_REPORT_SCHEMA_V1 =
  'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-report.v1';

const SCORED = 'scored';
const DIRECTIONS = Object.freeze(['narrower', 'unchanged', 'wider', 'mixed', 'not_scorable']);
const NONSCORED_DISPOSITIONS = Object.freeze([
  'persona_exit',
  'registered_move_not_delivered',
  'refusal_resolved',
  'unconditional_refusal_no_open_demand',
  'measurement_indeterminate',
]);
const DISPOSITIONS = new Set([SCORED, ...NONSCORED_DISPOSITIONS]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function repositoryRelative(root, candidate, label) {
  if (!candidate || path.isAbsolute(candidate)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside its repository`);
  }
  return relative.split(path.sep).join('/');
}

function exactKeys(value, required, label, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${label}_object_required`);
    return;
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) issues.push(`${label}_missing:${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key)) issues.push(`${label}_unexpected:${key}`);
  }
}

export function validateTutorStubFrameRefuserNarrowingDesign(design) {
  const issues = [];
  if (design?.schema !== TUTOR_STUB_FRAME_REFUSER_NARROWING_DESIGN_SCHEMA_V1) issues.push('schema');
  if (design?.studyId !== 'frame-refuser-narrowing-p1') issues.push('study_id');
  const reports = design?.source?.reportDirectories;
  if (!Array.isArray(reports) || reports.length !== 4) issues.push('source_reports');
  if (!/^[0-9a-f]{40}$/u.test(String(design?.source?.privateArchiveCommit || ''))) issues.push('source_commit');
  if (design?.sample?.size !== 24) issues.push('sample_size');
  if (!Number.isInteger(design?.sample?.masterSeed)) issues.push('sample_seed');
  if (JSON.stringify(design?.sample?.versions) !== JSON.stringify(['v1', 'v2', 'v3', 'v4'])) {
    issues.push('sample_versions');
  }
  if (JSON.stringify(design?.sample?.arms) !== JSON.stringify(['reference', 'treatment'])) {
    issues.push('sample_arms');
  }
  if (JSON.stringify(design?.sample?.worlds) !== JSON.stringify(['world_005_marrick', 'world_030_rowan_flat'])) {
    issues.push('sample_worlds');
  }
  if (design?.sample?.perVersion !== 6 || design?.sample?.perArm !== 12 || design?.sample?.perWorld !== 12) {
    issues.push('sample_balance');
  }
  const seats = design?.readers?.seats;
  const expectedSeats = [
    ['reader_a', 'codex.gpt-5.6-sol', 'codex', 'gpt-5.6-sol', 'low'],
    ['reader_b', 'claude-code.sonnet-5', 'claude-code', 'claude-sonnet-5', 'low'],
    ['reader_c', 'claude-code.opus-5', 'claude-code', 'claude-opus-5', 'low'],
  ];
  if (
    !Array.isArray(seats) ||
    JSON.stringify(seats.map((seat) => [seat.id, seat.modelRef, seat.provider, seat.model, seat.effort])) !==
      JSON.stringify(expectedSeats)
  ) {
    issues.push('reader_routes');
  }
  if (design?.readers?.attemptsPerSeatPerRow !== 1 || design?.readers?.automaticRetries !== 0) {
    issues.push('reader_attempts');
  }
  if (
    design?.attemptCeiling?.plannedCalls !== 72 ||
    design?.attemptCeiling?.maximumAttempts !== 72 ||
    design?.attemptCeiling?.maximumAttempts !== design?.sample?.size * expectedSeats.length
  ) {
    issues.push('attempt_ceiling');
  }
  if (design?.agreementGates?.minimumEligibleRowRatePerSeat !== 0.9) issues.push('eligibility_floor');
  if (design?.agreementGates?.minimumPairwiseExactAgreement !== 0.8) issues.push('agreement_floor');
  if (design?.agreementGates?.minimumPairwiseDirectionRows !== 20) issues.push('agreement_denominator');
  if (
    design?.spreadGate?.minimumScorableRowsPerArm !== 8 ||
    design?.spreadGate?.minimumDistinctFinalStateTuples !== 3 ||
    design?.spreadGate?.minimumMovementRate !== 0.25 ||
    design?.spreadGate?.minimumAbsoluteNarrowerRateGap !== 0.15
  ) {
    issues.push('spread_floors');
  }
  if (design?.launch?.designGrantsModelCalls !== false) issues.push('call_authority');
  if (issues.length) throw new Error(`frame-refuser narrowing design invalid: ${issues.join(', ')}`);
  return design;
}

export function loadTutorStubFrameRefuserNarrowingDesign({ root, designPath }) {
  const relativePath = repositoryRelative(root, designPath, 'design path');
  const bytes = fs.readFileSync(path.resolve(root, relativePath));
  const design = validateTutorStubFrameRefuserNarrowingDesign(JSON.parse(bytes.toString('utf8')));
  const instrumentPath = repositoryRelative(root, design.instrument.readerInstrumentPath, 'reader instrument path');
  const codebookPath = repositoryRelative(root, design.instrument.codebookPath, 'codebook path');
  return {
    design,
    relativePath,
    sha256: sha256(bytes),
    instrumentPath,
    instrumentText: fs.readFileSync(path.resolve(root, instrumentPath), 'utf8'),
    codebookPath,
  };
}

export function verifyTutorStubFrameRefuserNarrowingArchiveFile({ archiveRoot, commit, relativePath, bytes }) {
  const relative = repositoryRelative(archiveRoot, relativePath, 'archive input path');
  let committed;
  try {
    committed = execFileSync('git', ['show', `${commit}:${relative}`], {
      cwd: archiveRoot,
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    throw new Error(`sealed archive commit does not contain ${relative}`);
  }
  if (!committed.equals(bytes)) throw new Error(`archive input differs from sealed commit: ${relative}`);
  return true;
}

function rank(seed, purpose, value) {
  return sha256(`${seed}\0${purpose}\0${value}`);
}

function publicLearnerSurface(historyRow) {
  return String(historyRow?.light_adaptation?.current_signal?.public_learner_surface || '');
}

export function buildTutorStubFrameRefuserNarrowingPublicPacket({ row, transcript }) {
  const delivered = (Array.isArray(row?.delivery) ? row.delivery : [])
    .filter((entry) => entry?.delivered === true && Number.isInteger(Number(entry.turn)))
    .sort((left, right) => Number(left.turn) - Number(right.turn))[0];
  if (!delivered) throw new Error(`${row?.job?.id || 'row'} has no delivered intervention turn`);
  const triggerTurn = Number(delivered.turn);
  const horizon = Number(row?.job?.outcome_horizon_learner_turns);
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error(`${row.job.id} has no positive outcome horizon`);
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
  const trigger = turns.find((entry) => Number(entry.turn) === triggerTurn);
  if (!trigger) throw new Error(`${row.job.id} lacks trigger turn ${triggerTurn}`);
  const packet = {
    trigger: String(trigger.learner || ''),
    intervention: String(trigger.tutor || ''),
  };
  for (let index = 1; index < horizon; index += 1) {
    const turn = turns.find((entry) => Number(entry.turn) === triggerTurn + index);
    if (!turn) throw new Error(`${row.job.id} lacks post-trigger turn ${index}`);
    packet[`post_${index}`] = String(turn.learner || '');
    packet[`tutor_${index}`] = String(turn.tutor || '');
  }
  const finalHistory = (transcript?.registerSelection?.history || []).find(
    (entry) => Number(entry?.turn) === triggerTurn + horizon,
  );
  packet[`post_${horizon}`] = publicLearnerSurface(finalHistory);
  if (Object.values(packet).some((value) => !String(value).trim())) {
    throw new Error(`${row.job.id} produced an empty public packet field`);
  }
  return { packet, triggerTurn, horizon };
}

function selectedByRank(rows, count, seed, purpose) {
  return [...rows]
    .sort(
      (left, right) =>
        rank(seed, purpose, left.job.id).localeCompare(rank(seed, purpose, right.job.id)) ||
        left.job.id.localeCompare(right.job.id),
    )
    .slice(0, count);
}

function balanceCounts(cases, key) {
  return Object.fromEntries(
    [...new Set(cases.map((entry) => entry[key]))]
      .sort()
      .map((value) => [value, cases.filter((entry) => entry[key] === value).length]),
  );
}

export function buildTutorStubFrameRefuserNarrowingPlan({
  loaded,
  archiveRoot,
  verifyCommittedFile = verifyTutorStubFrameRefuserNarrowingArchiveFile,
}) {
  const { design } = loaded;
  const sourceRows = [];
  const verifiedReports = [];
  for (const source of design.source.reportDirectories) {
    const reportRelative = `${source.path}/report.json`;
    const reportPath = path.resolve(archiveRoot, repositoryRelative(archiveRoot, reportRelative, 'report path'));
    const reportBytes = fs.readFileSync(reportPath);
    verifyCommittedFile({
      archiveRoot,
      commit: design.source.privateArchiveCommit,
      relativePath: reportRelative,
      bytes: reportBytes,
    });
    const report = JSON.parse(reportBytes.toString('utf8'));
    verifiedReports.push({ version: source.version, path: reportRelative, sha256: sha256(reportBytes) });
    for (const row of report.rows || []) {
      if (row?.status !== 'complete') continue;
      if (!design.sample.arms.includes(row?.job?.arm_id) || !design.sample.worlds.includes(row?.job?.world)) continue;
      sourceRows.push({ ...row, sourceVersion: source.version, sourceDirectory: source.path });
    }
  }

  const strata = [];
  for (const version of design.sample.versions) {
    for (const arm of design.sample.arms) {
      const rows = sourceRows.filter((row) => row.sourceVersion === version && row.job.arm_id === arm);
      const byWorld = Object.fromEntries(
        design.sample.worlds.map((world) => [world, rows.filter((row) => row.job.world === world)]),
      );
      if (design.sample.worlds.some((world) => byWorld[world].length < 1)) {
        throw new Error(`narrowing sample stratum ${version}/${arm} lacks a complete row in both worlds`);
      }
      strata.push({ key: `${version}/${arm}`, version, arm, byWorld });
    }
  }
  const extraWorld = 'world_005_marrick';
  const extraEligible = strata.filter((stratum) => stratum.byWorld[extraWorld].length >= 2);
  if (extraEligible.length < 4) throw new Error('narrowing sample cannot allocate four extra Marrick rows');
  const extraMarrickKeys = new Set(
    [...extraEligible]
      .sort((left, right) =>
        rank(design.sample.masterSeed, 'extra-world', left.key).localeCompare(
          rank(design.sample.masterSeed, 'extra-world', right.key),
        ),
      )
      .slice(0, 4)
      .map((stratum) => stratum.key),
  );

  const selected = [];
  for (const stratum of strata) {
    for (const world of design.sample.worlds) {
      selected.push(
        ...selectedByRank(stratum.byWorld[world], 1, design.sample.masterSeed, `base/${stratum.key}/${world}`),
      );
    }
    const selectedExtraWorld = extraMarrickKeys.has(stratum.key) ? extraWorld : 'world_030_rowan_flat';
    const baseId = selected.find(
      (row) =>
        row.sourceVersion === stratum.version && row.job.arm_id === stratum.arm && row.job.world === selectedExtraWorld,
    )?.job.id;
    const extraPool = stratum.byWorld[selectedExtraWorld].filter((row) => row.job.id !== baseId);
    if (!extraPool.length) throw new Error(`narrowing sample cannot allocate extra row for ${stratum.key}`);
    selected.push(
      ...selectedByRank(extraPool, 1, design.sample.masterSeed, `extra/${stratum.key}/${selectedExtraWorld}`),
    );
  }
  if (selected.length !== design.sample.size || new Set(selected.map((row) => row.job.id)).size !== selected.length) {
    throw new Error('narrowing sample did not produce 24 unique rows');
  }

  const blinded = [...selected].sort((left, right) =>
    rank(design.sample.masterSeed, 'blind-case-id', left.job.id).localeCompare(
      rank(design.sample.masterSeed, 'blind-case-id', right.job.id),
    ),
  );
  const cases = blinded.map((row, index) => {
    const transcriptRelative = `${row.sourceDirectory}/${row.transcript}`;
    const transcriptPath = path.resolve(
      archiveRoot,
      repositoryRelative(archiveRoot, transcriptRelative, 'transcript path'),
    );
    const transcriptBytes = fs.readFileSync(transcriptPath);
    verifyCommittedFile({
      archiveRoot,
      commit: design.source.privateArchiveCommit,
      relativePath: transcriptRelative,
      bytes: transcriptBytes,
    });
    const transcript = JSON.parse(transcriptBytes.toString('utf8'));
    const extracted = buildTutorStubFrameRefuserNarrowingPublicPacket({ row, transcript });
    return {
      case_id: `nrw_${String(index + 1).padStart(3, '0')}`,
      source: {
        version: row.sourceVersion,
        job_id: row.job.id,
        arm_id: row.job.arm_id,
        world: row.job.world,
        report_path: `${row.sourceDirectory}/report.json`,
        transcript_path: transcriptRelative,
        transcript_sha256: sha256(transcriptBytes),
      },
      trigger_turn: extracted.triggerTurn,
      horizon: extracted.horizon,
      public_packet: extracted.packet,
      packet_sha256: sha256(JSON.stringify(extracted.packet)),
    };
  });
  const balances = {
    version: balanceCounts(
      cases.map((entry) => ({ ...entry, version: entry.source.version })),
      'version',
    ),
    arm: balanceCounts(
      cases.map((entry) => ({ ...entry, arm: entry.source.arm_id })),
      'arm',
    ),
    world: balanceCounts(
      cases.map((entry) => ({ ...entry, world: entry.source.world })),
      'world',
    ),
  };
  if (
    Object.values(balances.version).some((count) => count !== design.sample.perVersion) ||
    Object.values(balances.arm).some((count) => count !== design.sample.perArm) ||
    Object.values(balances.world).some((count) => count !== design.sample.perWorld)
  ) {
    throw new Error(`narrowing sample balance failed: ${JSON.stringify(balances)}`);
  }
  return {
    schema: TUTOR_STUB_FRAME_REFUSER_NARROWING_PLAN_SCHEMA_V1,
    study_id: design.studyId,
    status: 'passed_zero_call',
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    reader_instrument: { path: loaded.instrumentPath, sha256: sha256(loaded.instrumentText) },
    source: {
      private_archive_commit: design.source.privateArchiveCommit,
      reports: verifiedReports,
      eligible_complete_rows: sourceRows.length,
    },
    sample: { size: cases.length, seed: design.sample.masterSeed, balances },
    readers: design.readers.seats,
    planned_model_calls: design.attemptCeiling.plannedCalls,
    hard_attempt_ceiling: design.attemptCeiling.maximumAttempts,
    model_calls_executed: 0,
    cases,
  };
}

function learnerSourceIds(publicPacket) {
  return Object.keys(publicPacket).filter((key) => key === 'trigger' || /^post_\d+$/u.test(key));
}

function dialogueRows(publicPacket) {
  const rows = [{ source_id: 'trigger', speaker: 'learner', text: publicPacket.trigger }];
  if (publicPacket.intervention)
    rows.push({ source_id: 'intervention', speaker: 'tutor', text: publicPacket.intervention });
  const postIds = learnerSourceIds(publicPacket).filter((key) => key !== 'trigger');
  for (const postId of postIds) {
    rows.push({ source_id: postId, speaker: 'learner', text: publicPacket[postId] });
    const index = Number(postId.slice('post_'.length));
    const tutorId = `tutor_${index}`;
    if (publicPacket[tutorId]) rows.push({ source_id: tutorId, speaker: 'tutor', text: publicPacket[tutorId] });
  }
  return rows;
}

function evidenceSchema(ids) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['source_id', 'text'],
    properties: {
      source_id: { type: 'string', enum: ids },
      text: { type: 'string', minLength: 1 },
    },
  };
}

function ledgerItemSchema(ids) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['description', 'evidence'],
    properties: {
      description: { type: 'string', minLength: 1 },
      evidence: { type: 'array', minItems: 1, items: evidenceSchema(ids) },
    },
  };
}

export function buildTutorStubFrameRefuserNarrowingReaderPrompt({ instrumentText, caseId, publicPacket }) {
  const ids = learnerSourceIds(publicPacket);
  const boundSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['score', 'description', 'evidence'],
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 3 },
      description: { type: 'string', minLength: 1 },
      evidence: { type: 'array', minItems: 1, items: evidenceSchema(ids) },
    },
  };
  const outputSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['case_id', 'states'],
    properties: {
      case_id: { type: 'string', enum: [caseId] },
      states: {
        type: 'array',
        minItems: ids.length,
        maxItems: ids.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source_id', 'disposition', 'open_demands', 'tightest_bound', 'conceded_subclaims'],
          properties: {
            source_id: { type: 'string', enum: ids },
            disposition: { type: 'string', enum: [SCORED, ...NONSCORED_DISPOSITIONS] },
            open_demands: { type: 'array', maxItems: 20, items: ledgerItemSchema(ids) },
            tightest_bound: { anyOf: [{ type: 'null' }, boundSchema] },
            conceded_subclaims: { type: 'array', maxItems: 20, items: ledgerItemSchema(ids) },
          },
        },
      },
    },
  };
  return {
    case_id: caseId,
    learner_source_ids: ids,
    public_packet: publicPacket,
    system_prompt: [
      'You are one independent semantic measurement seat. Use only the supplied public dialogue and rule-only instrument.',
      'Return strict JSON matching the schema. Do not use tools, external knowledge, hidden-state inference, study-arm inference, or prior reader votes.',
      instrumentText.trim(),
    ].join('\n\n'),
    user_prompt: JSON.stringify({ case_id: caseId, public_dialogue: dialogueRows(publicPacket) }),
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

function validateEvidenceRows(rows, stateIndex, prompt, label, issues) {
  if (!Array.isArray(rows) || rows.length < 1) {
    issues.push(`${label}_evidence_required`);
    return [];
  }
  return rows.map((row, index) => {
    exactKeys(row, ['source_id', 'text'], `${label}_evidence_${index}`, issues);
    const sourceIndex = prompt.learner_source_ids.indexOf(row?.source_id);
    if (sourceIndex < 0) issues.push(`${label}_evidence_${index}_source`);
    if (sourceIndex > stateIndex) issues.push(`${label}_evidence_${index}_future_source`);
    const sourceText = String(prompt.public_packet[row?.source_id] || '');
    if (!String(row?.text || '') || !sourceText.includes(String(row.text))) {
      issues.push(`${label}_evidence_${index}_not_exact`);
    }
    return { source_id: String(row?.source_id || ''), text: String(row?.text || '') };
  });
}

function validateLedger(items, stateIndex, prompt, label, issues) {
  if (!Array.isArray(items)) {
    issues.push(`${label}_array_required`);
    return [];
  }
  const normalized = items.map((item, index) => {
    exactKeys(item, ['description', 'evidence'], `${label}_${index}`, issues);
    if (!String(item?.description || '').trim()) issues.push(`${label}_${index}_description`);
    return {
      description: String(item?.description || '').trim(),
      evidence: validateEvidenceRows(item?.evidence, stateIndex, prompt, `${label}_${index}`, issues),
    };
  });
  const descriptions = normalized.map((item) => item.description.toLowerCase());
  if (new Set(descriptions).size !== descriptions.length) issues.push(`${label}_duplicate_description`);
  return normalized;
}

export function deriveTutorStubFrameRefuserNarrowingDirection(states) {
  const first = states?.[0];
  const last = states?.at(-1);
  if (!first || !last || first.disposition !== SCORED || last.disposition !== SCORED) return 'not_scorable';
  const comparisons = [
    Math.sign(first.open_demand_count - last.open_demand_count),
    Math.sign(last.bound_tightness - first.bound_tightness),
    Math.sign(last.conceded_subclaim_count - first.conceded_subclaim_count),
  ];
  const improves = comparisons.filter((value) => value > 0).length;
  const worsens = comparisons.filter((value) => value < 0).length;
  if (improves && !worsens) return 'narrower';
  if (worsens && !improves) return 'wider';
  if (!improves && !worsens) return 'unchanged';
  return 'mixed';
}

export function evaluateTutorStubFrameRefuserNarrowingReaderResponse({ response, seat, prompt }) {
  const issues = [];
  const output = parseJsonObject(response?.text ?? response);
  exactKeys(output, ['case_id', 'states'], 'output', issues);
  if (output?.case_id !== prompt.case_id) issues.push('case_id');
  if (!Array.isArray(output?.states) || output.states.length !== prompt.learner_source_ids.length) {
    issues.push('states_length');
  }
  const states = [];
  for (const [stateIndex, expectedSourceId] of prompt.learner_source_ids.entries()) {
    const state = output?.states?.[stateIndex];
    exactKeys(
      state,
      ['source_id', 'disposition', 'open_demands', 'tightest_bound', 'conceded_subclaims'],
      `state_${stateIndex}`,
      issues,
    );
    if (state?.source_id !== expectedSourceId) issues.push(`state_${stateIndex}_source_order`);
    if (!DISPOSITIONS.has(state?.disposition)) issues.push(`state_${stateIndex}_disposition`);
    const openDemands = validateLedger(state?.open_demands, stateIndex, prompt, `state_${stateIndex}_open`, issues);
    const concessions = validateLedger(
      state?.conceded_subclaims,
      stateIndex,
      prompt,
      `state_${stateIndex}_concession`,
      issues,
    );
    let tightestBound = null;
    if (state?.disposition === SCORED) {
      if (openDemands.length < 1) issues.push(`state_${stateIndex}_scored_requires_open_demand`);
      exactKeys(state?.tightest_bound, ['score', 'description', 'evidence'], `state_${stateIndex}_bound`, issues);
      if (
        !Number.isInteger(state?.tightest_bound?.score) ||
        state.tightest_bound.score < 0 ||
        state.tightest_bound.score > 3
      ) {
        issues.push(`state_${stateIndex}_bound_score`);
      }
      if (!String(state?.tightest_bound?.description || '').trim())
        issues.push(`state_${stateIndex}_bound_description`);
      tightestBound = {
        score: Number(state?.tightest_bound?.score),
        description: String(state?.tightest_bound?.description || '').trim(),
        evidence: validateEvidenceRows(
          state?.tightest_bound?.evidence,
          stateIndex,
          prompt,
          `state_${stateIndex}_bound`,
          issues,
        ),
      };
    } else if (state?.tightest_bound !== null || openDemands.length || concessions.length) {
      issues.push(`state_${stateIndex}_categorical_must_be_unscored`);
    }
    states.push({
      source_id: expectedSourceId,
      disposition: DISPOSITIONS.has(state?.disposition) ? state.disposition : 'measurement_indeterminate',
      open_demands: openDemands,
      open_demand_count: openDemands.length,
      tightest_bound: tightestBound,
      bound_tightness: tightestBound?.score ?? null,
      conceded_subclaims: concessions,
      conceded_subclaim_count: concessions.length,
    });
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
    output,
    states,
    direction: deriveTutorStubFrameRefuserNarrowingDirection(states),
  };
}

function pairs(values) {
  const result = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) result.push([values[left], values[right]]);
  }
  return result;
}

function agreementStat(values) {
  const denominator = values.length;
  const numerator = values.filter(([left, right]) => left === right).length;
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

function modal(values, minimum = 2) {
  const counts = new Map();
  for (const value of values.filter((entry) => entry !== undefined && entry !== null)) {
    counts.set(JSON.stringify(value), { value, count: (counts.get(JSON.stringify(value))?.count || 0) + 1 });
  }
  const ranked = [...counts.values()].sort((left, right) => right.count - left.count);
  if (!ranked.length || ranked[0].count < minimum || ranked[0].count === ranked[1]?.count) return null;
  return ranked[0].value;
}

function ratePass(stat, floor) {
  return stat.rate !== null && stat.rate >= floor;
}

export function summarizeTutorStubFrameRefuserNarrowingCalibration({ plan, records, design }) {
  const seats = design.readers.seats;
  const recordFor = (caseId, seatId) =>
    records.find((entry) => entry.case_id === caseId && entry.seat_id === seatId)?.measurement || null;
  const seatEligibility = Object.fromEntries(
    seats.map((seat) => {
      const eligible = plan.cases.filter((entry) => recordFor(entry.case_id, seat.id)?.eligible === true).length;
      const rate = eligible / plan.cases.length;
      return [
        seat.id,
        {
          eligible,
          assigned: plan.cases.length,
          rate,
          pass: rate >= design.agreementGates.minimumEligibleRowRatePerSeat,
        },
      ];
    }),
  );
  const pairwise = {};
  for (const [left, right] of pairs(seats)) {
    const key = `${left.id}__${right.id}`;
    const observations = {
      disposition: [],
      open_demands: [],
      bound_tightness: [],
      conceded_subclaims: [],
      direction: [],
    };
    for (const entry of plan.cases) {
      const leftResult = recordFor(entry.case_id, left.id);
      const rightResult = recordFor(entry.case_id, right.id);
      if (!leftResult?.eligible || !rightResult?.eligible) continue;
      observations.direction.push([leftResult.direction, rightResult.direction]);
      for (const [index, leftState] of leftResult.states.entries()) {
        const rightState = rightResult.states[index];
        if (!rightState || leftState.source_id !== rightState.source_id) continue;
        observations.disposition.push([leftState.disposition, rightState.disposition]);
        if (leftState.disposition === SCORED && rightState.disposition === SCORED) {
          observations.open_demands.push([leftState.open_demand_count, rightState.open_demand_count]);
          observations.bound_tightness.push([leftState.bound_tightness, rightState.bound_tightness]);
          observations.conceded_subclaims.push([leftState.conceded_subclaim_count, rightState.conceded_subclaim_count]);
        }
      }
    }
    const metrics = Object.fromEntries(
      Object.entries(observations).map(([name, values]) => [name, agreementStat(values)]),
    );
    const pass =
      metrics.direction.denominator >= design.agreementGates.minimumPairwiseDirectionRows &&
      Object.values(metrics).every((stat) => ratePass(stat, design.agreementGates.minimumPairwiseExactAgreement));
    pairwise[key] = { seats: [left.id, right.id], metrics, pass };
  }
  const agreementPass =
    Object.values(seatEligibility).every((entry) => entry.pass) && Object.values(pairwise).every((entry) => entry.pass);

  const consensusRows = plan.cases.map((entry) => {
    const eligible = seats
      .map((seat) => recordFor(entry.case_id, seat.id))
      .filter((measurement) => measurement?.eligible);
    const finalStates = eligible.map((measurement) => measurement.states.at(-1));
    const finalVote = modal(
      finalStates.map((state) =>
        state?.disposition === SCORED
          ? [SCORED, state.open_demand_count, state.bound_tightness, state.conceded_subclaim_count]
          : [state?.disposition || 'measurement_indeterminate'],
      ),
    );
    const final =
      finalVote?.[0] === SCORED
        ? {
            disposition: SCORED,
            open_demand_count: finalVote[1],
            bound_tightness: finalVote[2],
            conceded_subclaim_count: finalVote[3],
          }
        : { disposition: finalVote?.[0] || 'measurement_indeterminate' };
    const direction = modal(eligible.map((measurement) => measurement.direction)) || 'not_scorable';
    const finalTuple =
      final.disposition === SCORED &&
      [final.open_demand_count, final.bound_tightness, final.conceded_subclaim_count].every(Number.isInteger)
        ? [final.open_demand_count, final.bound_tightness, final.conceded_subclaim_count]
        : null;
    return {
      case_id: entry.case_id,
      arm_id: entry.source.arm_id,
      eligible_seats: eligible.length,
      direction,
      final_state: final,
      final_state_tuple: finalTuple,
    };
  });
  const armSummary = Object.fromEntries(
    design.sample.arms.map((arm) => {
      const rows = consensusRows.filter((row) => row.arm_id === arm);
      const directions = Object.fromEntries(
        DIRECTIONS.map((direction) => [direction, rows.filter((row) => row.direction === direction).length]),
      );
      const scorable = rows.filter((row) => row.direction !== 'not_scorable').length;
      const dispositions = Object.fromEntries(
        [SCORED, ...NONSCORED_DISPOSITIONS].map((disposition) => [
          disposition,
          rows.filter((row) => row.final_state.disposition === disposition).length,
        ]),
      );
      return [
        arm,
        {
          assigned: rows.length,
          scorable,
          directions,
          final_dispositions: dispositions,
          narrower_rate_assigned: rows.length ? directions.narrower / rows.length : null,
        },
      ];
    }),
  );
  const distinctTuples = new Set(
    consensusRows.filter((row) => row.final_state_tuple).map((row) => JSON.stringify(row.final_state_tuple)),
  ).size;
  const movementRows = consensusRows.filter((row) => ['narrower', 'wider', 'mixed'].includes(row.direction)).length;
  const movementRate = movementRows / consensusRows.length;
  const narrowerRateGap = Math.abs(
    armSummary.reference.narrower_rate_assigned - armSummary.treatment.narrower_rate_assigned,
  );
  const spreadChecks = {
    scorable_rows_per_arm: {
      observed: Object.fromEntries(design.sample.arms.map((arm) => [arm, armSummary[arm].scorable])),
      floor: design.spreadGate.minimumScorableRowsPerArm,
      pass: design.sample.arms.every((arm) => armSummary[arm].scorable >= design.spreadGate.minimumScorableRowsPerArm),
    },
    distinct_final_state_tuples: {
      observed: distinctTuples,
      floor: design.spreadGate.minimumDistinctFinalStateTuples,
      pass: distinctTuples >= design.spreadGate.minimumDistinctFinalStateTuples,
    },
    movement_rate_assigned: {
      observed: movementRate,
      floor: design.spreadGate.minimumMovementRate,
      pass: movementRate >= design.spreadGate.minimumMovementRate,
    },
    absolute_narrower_rate_gap: {
      observed: narrowerRateGap,
      floor: design.spreadGate.minimumAbsoluteNarrowerRateGap,
      pass: narrowerRateGap >= design.spreadGate.minimumAbsoluteNarrowerRateGap,
    },
  };
  const spreadPass = Object.values(spreadChecks).every((entry) => entry.pass);
  return {
    schema: TUTOR_STUB_FRAME_REFUSER_NARROWING_REPORT_SCHEMA_V1,
    study_id: design.studyId,
    status: !agreementPass ? 'failed_agreement' : spreadPass ? 'passed_instrument_gate' : 'no_spread',
    claim_boundary: design.claimBoundary,
    agreement: {
      floor: design.agreementGates.minimumPairwiseExactAgreement,
      minimum_eligible_row_rate_per_seat: design.agreementGates.minimumEligibleRowRatePerSeat,
      seat_eligibility: seatEligibility,
      pairwise,
      pass: agreementPass,
    },
    spread: { checks: spreadChecks, arm_summary: armSummary, pass: spreadPass },
    rows: consensusRows,
    fresh_study_gate_open: agreementPass && spreadPass,
    archived_rows_confirmatory: false,
  };
}
