import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PROGRAM2_STALL_AUDIT_SCHEMA = 'machinespirits.program2.stall-audit.v1';
export const PROGRAM2_STALL_CANDIDATE_AUDIT_SCHEMA = 'machinespirits.program2.stall-candidate-audit.v1';
export const PROGRAM2_STALL_INVENTORY_SCHEMA = 'machinespirits.program2.stall-inventory.v1';
export const PROGRAM2_STALL_TRIGGER = 'stagnant_repeat';
export const PROGRAM2_STALL_DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
export const PROGRAM2_STALL_CORPUS_FLOOR = 100;

const REANCHOR_FAMILIES = new Set(['reanchor_public_evidence', 'ground_in_material']);

export function auditProgram2StallCandidate({ assignment, tutorText, releasedPremiseCount = 0, guardsPassed } = {}) {
  const duePremiseCount = Array.isArray(assignment?.inputs?.due_premises) ? assignment.inputs.due_premises.length : 0;
  const questionCount = (String(tutorText || '').match(/\?/gu) || []).length;
  const released = Number(releasedPremiseCount || 0);
  const evaluable = duePremiseCount > 0;
  const components = {
    due_premise_path_observable: evaluable,
    release_increased: evaluable ? released > 0 : null,
    final_delivery_guards_passed: guardsPassed === true,
    exactly_one_question: questionCount === 1,
  };
  return {
    schema: PROGRAM2_STALL_CANDIDATE_AUDIT_SCHEMA,
    evaluable,
    unevaluableReason: evaluable ? null : 'semantic action-family realization is not observable from text alone',
    compliant: evaluable
      ? components.release_increased && components.final_delivery_guards_passed && components.exactly_one_question
      : null,
    components,
    duePremiseCount,
    releasedPremiseCount: released,
    questionCount,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readEvents(filePath) {
  const events = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // A malformed diagnostic line cannot manufacture an eligible moment.
    }
  }
  return events;
}

function finalGuardStatus(turnRecord) {
  const recorded = turnRecord?.tutorGuardAccounting?.finalDelivery?.audits?.auditOk;
  if (typeof recorded === 'boolean') return recorded;
  const candidates = [
    turnRecord?.tutorLeakAudit?.ok,
    turnRecord?.tutorHumanScaffoldAudit?.ok,
    turnRecord?.tutorQuestionSupportAudit?.ok,
    turnRecord?.tutorDramaticReleaseAudit?.ok,
    turnRecord?.responseComposition?.audit?.ok,
    turnRecord?.tutorRepetitionAudit?.ok,
    turnRecord?.tutorDialogueClosureAudit?.ok,
  ].filter((value) => typeof value === 'boolean');
  return candidates.length ? candidates.every(Boolean) : null;
}

export function auditProgram2StallMoment({ assignment, compliance, turnRecord } = {}) {
  const inputs = assignment?.inputs || {};
  const previous = Array.isArray(inputs.previous_action_families)
    ? inputs.previous_action_families.slice(-4).map(String)
    : [];
  const proposed = String(inputs.proposed_action_family || '');
  const repeatedFamily = previous.at(-1) || null;
  const duePremises = Array.isArray(inputs.due_premises) ? inputs.due_premises : [];
  const realized = String(compliance?.realized_action_family || '');
  const released = Number(compliance?.released_premise_count || 0);
  const questionCount = Number(
    compliance?.question_count ?? (String(turnRecord?.tutor || '').match(/\?/gu) || []).length,
  );
  const guardsPassed = finalGuardStatus(turnRecord);
  const detectorReplayPassed =
    Number(inputs.stagnation) >= 0.6 &&
    previous.length === 4 &&
    Boolean(proposed) &&
    previous.every((family) => family === proposed);
  const dueReleasePath = duePremises.length > 0 && released > 0 && realized === 'stage_next_step';
  const reanchorPath =
    duePremises.length === 0 &&
    released === 0 &&
    REANCHOR_FAMILIES.has(realized) &&
    Boolean(repeatedFamily) &&
    realized !== repeatedFamily;
  const integrity = {
    assignment_schema: assignment?.schema === 'machinespirits.tutor-stub.point-of-action-turn.v1',
    detector_version: assignment?.detector_version === PROGRAM2_STALL_DETECTOR_VERSION,
    assigned_trigger: assignment?.assigned_trigger === PROGRAM2_STALL_TRIGGER,
    compliance_present: Boolean(compliance),
    compliance_schema: compliance?.schema === 'machinespirits.tutor-stub.point-of-action-compliance.v1',
    compliance_detector_version: compliance?.detector_version === PROGRAM2_STALL_DETECTOR_VERSION,
    compliance_trigger: compliance?.trigger === PROGRAM2_STALL_TRIGGER,
    turn_match: Number(assignment?.turn) === Number(compliance?.turn),
    arm_match: assignment?.arm === compliance?.arm,
    delivered_text_present: Boolean(String(turnRecord?.tutor || '').trim()),
  };
  const components = {
    detector_replay_passed: detectorReplayPassed,
    due_release_path: dueReleasePath,
    reanchor_path: reanchorPath,
    correct_break_path: dueReleasePath || reanchorPath,
    final_delivery_guards_observable: guardsPassed !== null,
    final_delivery_guards_passed: guardsPassed === true,
    exactly_one_question: questionCount === 1,
  };
  const failures = [
    ...Object.entries(integrity)
      .filter(([, passed]) => !passed)
      .map(([key]) => `integrity:${key}`),
    ...Object.entries(components)
      .filter(([key, passed]) => !passed && !['due_release_path', 'reanchor_path'].includes(key))
      .map(([key]) => `component:${key}`),
  ];
  return {
    schema: PROGRAM2_STALL_AUDIT_SCHEMA,
    passed: failures.length === 0,
    failures,
    integrity,
    components,
    path: dueReleasePath ? 'due_release' : reanchorPath ? 'public_reanchor' : 'none',
    repeatedFamily,
    realizedActionFamily: realized || null,
    duePremiseCount: duePremises.length,
    releasedPremiseCount: released,
    questionCount,
  };
}

function sealedTraceFile(traceDir) {
  if (!fs.existsSync(traceDir)) return null;
  const candidates = fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .reverse();
  for (const name of candidates) {
    const filePath = path.join(traceDir, name);
    const events = readEvents(filePath);
    if (events.some((event) => event.type === 'run_end')) return { filePath, events };
  }
  return null;
}

function summarizeRows(rows, key) {
  const buckets = new Map();
  for (const row of rows) {
    const value = row[key] || 'unknown';
    const current = buckets.get(value) || { key: value, moments: 0, auditPassing: 0 };
    current.moments += 1;
    current.auditPassing += row.audit.passed ? 1 : 0;
    buckets.set(value, current);
  }
  return [...buckets.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

function failureCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const failure of row.audit.failures) counts.set(failure, (counts.get(failure) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([failure, count]) => ({ failure, count }))
    .sort((a, b) => b.count - a.count || a.failure.localeCompare(b.failure));
}

export function auditProgram2StallArchives(rootSpecs) {
  const rows = [];
  const archives = [];
  for (const spec of rootSpecs) {
    const root = path.resolve(spec.root);
    const launchPlanPath = path.join(root, 'launch-plan.json');
    if (!fs.existsSync(launchPlanPath)) throw new Error(`${spec.label}: missing launch-plan.json`);
    const launchPlanBytes = fs.readFileSync(launchPlanPath);
    const launchPlan = JSON.parse(launchPlanBytes.toString('utf8'));
    const jobs = launchPlan?.plan?.jobs || [];
    let sealedJobs = 0;
    const missingJobIds = [];
    const selectedTraceFingerprints = [];
    for (const job of jobs) {
      const sealed = sealedTraceFile(path.join(root, 'traces', job.id));
      if (!sealed) {
        missingJobIds.push(job.id);
        continue;
      }
      sealedJobs += 1;
      const traceBytes = fs.readFileSync(sealed.filePath);
      selectedTraceFingerprints.push(`${job.id}:${sha256(traceBytes)}`);
      const assignments = new Map();
      const compliances = new Map();
      const turnRecords = new Map();
      let provenanceSha = null;
      for (const event of sealed.events) {
        if (event.type === 'run_start') provenanceSha = event.metadata?.provenance?.git?.sha || null;
        else if (event.type === 'point_of_action_assignment' && event.pointOfAction)
          assignments.set(Number(event.turn), event.pointOfAction);
        else if (event.type === 'point_of_action_compliance' && event.compliance)
          compliances.set(Number(event.turn), event.compliance);
        else if (event.type === 'turn_complete' && event.turnRecord)
          turnRecords.set(Number(event.turn), event.turnRecord);
      }
      for (const [turn, assignment] of assignments) {
        if (assignment.assigned_trigger !== PROGRAM2_STALL_TRIGGER) continue;
        const compliance = compliances.get(turn) || null;
        const turnRecord = turnRecords.get(turn) || null;
        rows.push({
          archive: spec.label,
          job: job.id,
          profile: job.profile || 'unknown',
          arm: job.arm || assignment.arm || 'unknown',
          turn,
          provenanceSha,
          trace: path.relative(root, sealed.filePath),
          assignment,
          compliance,
          tutorText: turnRecord?.tutor || null,
          audit: auditProgram2StallMoment({ assignment, compliance, turnRecord }),
        });
      }
    }
    archives.push({
      label: spec.label,
      plannedJobs: jobs.length,
      sealedJobs,
      missingJobs: jobs.length - sealedJobs,
      missingJobIds,
      launchPlanSha256: sha256(launchPlanBytes),
      selectedTraceSetSha256: sha256(selectedTraceFingerprints.sort().join('\n')),
    });
  }
  const auditPassing = rows.filter((row) => row.audit.passed).length;
  return {
    schema: PROGRAM2_STALL_INVENTORY_SCHEMA,
    modelCalls: 0,
    trigger: PROGRAM2_STALL_TRIGGER,
    detectorVersion: PROGRAM2_STALL_DETECTOR_VERSION,
    rule: {
      duePremisePath: 'release at least one due premise with stage_next_step',
      noDuePremisePath: 'release none and change to reanchor_public_evidence or ground_in_material',
      finalDeliveryGuards: 'must be observable and pass',
      protectedSpan: 'exactly one question retained',
    },
    corpusFloor: PROGRAM2_STALL_CORPUS_FLOOR,
    decision: auditPassing >= PROGRAM2_STALL_CORPUS_FLOOR ? 'GO_PHASE2_DATASET_PREP' : 'NO_GO_CORPUS_FLOOR',
    archives,
    plannedDialogues: archives.reduce((sum, archive) => sum + archive.plannedJobs, 0),
    sealedDialogues: archives.reduce((sum, archive) => sum + archive.sealedJobs, 0),
    rawMoments: rows.length,
    auditPassing,
    questionCompatible: rows.filter((row) => row.audit.components.exactly_one_question).length,
    dueReleasePassing: rows.filter((row) => row.audit.passed && row.audit.path === 'due_release').length,
    reanchorPassing: rows.filter((row) => row.audit.passed && row.audit.path === 'public_reanchor').length,
    byArchive: summarizeRows(rows, 'archive'),
    byArm: summarizeRows(rows, 'arm'),
    byProfile: summarizeRows(rows, 'profile'),
    failures: failureCounts(rows),
    rows,
  };
}

export function renderProgram2StallAuditMarkdown(summary) {
  const table = (headers, rows) =>
    [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows].join('\n');
  return `${[
    '# Program-2 stall corpus audit',
    '',
    `- Decision: **${summary.decision}**`,
    `- Model calls: **${summary.modelCalls}**`,
    `- Sealed dialogues: **${summary.sealedDialogues}/${summary.plannedDialogues}**`,
    `- Raw stagnant-repeat moments: **${summary.rawMoments}**`,
    `- Strict audit-passing moments: **${summary.auditPassing}/${summary.corpusFloor} required**`,
    `- Exactly-one-question compatible: **${summary.questionCompatible}/${summary.rawMoments}**`,
    `- Passing paths: due release ${summary.dueReleasePassing}; public reanchor ${summary.reanchorPassing}`,
    '',
    '## Archive coverage',
    '',
    table(
      ['Archive', 'Planned', 'Sealed', 'Missing', 'Moments', 'Passing'],
      summary.archives.map((archive) => {
        const row = summary.byArchive.find((item) => item.key === archive.label) || { moments: 0, auditPassing: 0 };
        return `| ${archive.label} | ${archive.plannedJobs} | ${archive.sealedJobs} | ${archive.missingJobs} | ${row.moments} | ${row.auditPassing} |`;
      }),
    ),
    '',
    '## Failure grammar',
    '',
    table(
      ['Failure', 'Count'],
      summary.failures.map((row) => `| ${row.failure} | ${row.count} |`),
    ),
    '',
    'The audit is deterministic and reads sealed traces only. It does not license training or a live run.',
    '',
  ].join('\n')}\n`;
}
