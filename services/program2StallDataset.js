import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  auditProgram2StallArchives,
  PROGRAM2_STALL_AUDIT_SCHEMA,
  PROGRAM2_STALL_CORPUS_FLOOR,
  PROGRAM2_STALL_TRIGGER,
} from './program2StallAudit.js';

export const PROGRAM2_STALL_DATASET_SCHEMA = 'machinespirits.program2.stall-dataset.v1';
export const PROGRAM2_STALL_DATASET_REPORT_SCHEMA = 'machinespirits.program2.stall-dataset-report.v1';
export const PROGRAM2_STALL_SPLIT_SCHEMA = 'machinespirits.program2.stall-splits.v1';
export const PROGRAM2_STALL_SPLIT_SEED = 20260726;

const SPLIT_FRACTIONS = Object.freeze({ train: 0.8, dev: 0.1, heldout: 0.1 });

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readEvents(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function stableDialogueSplits(rows, seed) {
  const strata = new Map();
  for (const row of rows) {
    const key = row.profile || 'unknown';
    const dialogueId = `${row.archive}:${row.job}`;
    if (!strata.has(key)) strata.set(key, new Set());
    strata.get(key).add(dialogueId);
  }
  const byDialogue = new Map();
  for (const key of [...strata.keys()].sort()) {
    const ids = [...strata.get(key)].sort((left, right) => {
      const order = sha256(`${seed}:${key}:${left}`).localeCompare(sha256(`${seed}:${key}:${right}`));
      return order || left.localeCompare(right);
    });
    const heldoutCount = ids.length >= 3 ? Math.max(1, Math.round(ids.length * SPLIT_FRACTIONS.heldout)) : 0;
    const devCount = ids.length >= 3 ? Math.max(1, Math.round(ids.length * SPLIT_FRACTIONS.dev)) : 0;
    ids.forEach((id, index) => {
      byDialogue.set(id, index < heldoutCount ? 'heldout' : index < heldoutCount + devCount ? 'dev' : 'train');
    });
  }
  return byDialogue;
}

function writeJsonl(outputDir, name, rows) {
  const filePath = path.join(outputDir, name);
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
  return { name, rows: rows.length, sha256: sha256File(filePath) };
}

function originalTurnEvidence({ root, row }) {
  const traceFile = path.join(root, row.trace);
  const events = readEvents(traceFile);
  const complete = events.find(
    (event) => event.type === 'turn_complete' && Number(event.turn) === Number(row.turn) && event.turnRecord,
  );
  const originalCall = events.find(
    (event) =>
      event.type === 'model_call' &&
      event.role === 'tutor_stub_tutor' &&
      Number(event.turn) === Number(row.turn) &&
      event.request,
  );
  const turnRecord = complete?.turnRecord || null;
  const accounting = turnRecord?.tutorGuardAccounting || {};
  const originalText = originalCall?.response?.text ?? null;
  const deliveredText = turnRecord?.tutor ?? row.tutorText ?? null;
  const originalAccepted = accounting.outcome === 'guarded_original_accepted';
  const originalMatchesDelivery =
    Boolean(originalText && deliveredText) && String(originalText).trim() === String(deliveredText).trim();
  const leakClean =
    accounting.originalCandidate?.audits?.leakAudit?.ok !== false && turnRecord?.tutorLeakAudit?.ok !== false;
  return {
    traceFile,
    turnId: complete?.turnId || turnRecord?.turnId || originalCall?.turnId || null,
    request: originalCall?.request || null,
    originalText,
    deliveredText,
    originalAccepted,
    originalMatchesDelivery,
    leakClean,
  };
}

export function buildProgram2StallDataset({
  rootSpecs,
  outputDir,
  splitSeed = PROGRAM2_STALL_SPLIT_SEED,
  allowUnderFloor = false,
} = {}) {
  if (!Array.isArray(rootSpecs) || rootSpecs.length === 0)
    throw new Error('rootSpecs must contain at least one archive');
  if (!outputDir) throw new Error('outputDir is required');
  const audit = auditProgram2StallArchives(rootSpecs);
  const corpusGatePassed = audit.auditPassing >= PROGRAM2_STALL_CORPUS_FLOOR;
  if (!corpusGatePassed && !allowUnderFloor) {
    throw new Error(
      `stall corpus gate failed: ${audit.auditPassing}/${PROGRAM2_STALL_CORPUS_FLOOR}; pass allowUnderFloor only for an explicitly exploratory dataset`,
    );
  }

  const rootsByLabel = new Map(rootSpecs.map((spec) => [spec.label, path.resolve(spec.root)]));
  const splits = stableDialogueSplits(audit.rows, Number(splitSeed));
  const evaluationRows = [];
  const eligibleRows = [];
  const sourceLosses = {
    strictAuditFailed: 0,
    originalCallMissing: 0,
    originalNotAccepted: 0,
    leakFailed: 0,
  };
  const sourceTransformations = { deliveryFormattingNormalized: 0 };

  for (const row of audit.rows) {
    const root = rootsByLabel.get(row.archive);
    if (!root) throw new Error(`missing archive root for ${row.archive}`);
    const evidence = originalTurnEvidence({ root, row });
    const dialogueId = `${row.archive}:${row.job}`;
    const split = splits.get(dialogueId);
    const duePremiseCount = row.audit.duePremiseCount;
    const base = {
      source: row.archive,
      dialogueId,
      jobId: row.job,
      profile: row.profile,
      arm: row.arm,
      turn: row.turn,
      turnId: evidence.turnId,
      split,
      trigger: PROGRAM2_STALL_TRIGGER,
      request: evidence.request,
      trace: { archive: row.archive, file: row.trace, turnId: evidence.turnId },
    };
    evaluationRows.push({
      ...base,
      historicalText: evidence.deliveredText,
      historicalAuditPassed: row.audit.passed,
      historicalAuditPath: row.audit.path,
      duePremiseCount,
      freshTextAuditability: duePremiseCount > 0 ? 'deterministic_due_release' : 'requires_semantic_action_family',
    });

    if (!row.audit.passed) {
      sourceLosses.strictAuditFailed += 1;
      continue;
    }
    if (!evidence.request || !evidence.originalText) {
      sourceLosses.originalCallMissing += 1;
      continue;
    }
    if (!evidence.originalAccepted) {
      sourceLosses.originalNotAccepted += 1;
      continue;
    }
    if (!evidence.originalMatchesDelivery) sourceTransformations.deliveryFormattingNormalized += 1;
    if (!evidence.leakClean) {
      sourceLosses.leakFailed += 1;
      continue;
    }
    eligibleRows.push({
      ...base,
      target: evidence.originalText,
      historicalAudit: {
        schema: PROGRAM2_STALL_AUDIT_SCHEMA,
        path: row.audit.path,
        duePremiseCount,
      },
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const trainRows = eligibleRows.filter((row) => row.split === 'train');
  const devRows = eligibleRows.filter((row) => row.split === 'dev');
  const heldoutEligibleRows = eligibleRows.filter((row) => row.split === 'heldout');
  const sourceCorpusGatePassed = eligibleRows.length >= PROGRAM2_STALL_CORPUS_FLOOR;
  const splitGatePassed = trainRows.length > 0 && devRows.length > 0 && heldoutEligibleRows.length > 0;
  const licensedForTraining = corpusGatePassed && sourceCorpusGatePassed && splitGatePassed;
  const trainingProhibitedReasons = [
    ...(!corpusGatePassed
      ? [`strict historical audit floor failed: ${audit.auditPassing}/${PROGRAM2_STALL_CORPUS_FLOOR}`]
      : []),
    ...(!sourceCorpusGatePassed
      ? [`accepted-original source floor failed: ${eligibleRows.length}/${PROGRAM2_STALL_CORPUS_FLOOR}`]
      : []),
    ...(!splitGatePassed
      ? [
          `dialogue split is incomplete: train=${trainRows.length}, dev=${devRows.length}, heldout=${heldoutEligibleRows.length}`,
        ]
      : []),
  ];
  const files = [
    writeJsonl(outputDir, 'taskB-stall-sft.jsonl', trainRows),
    writeJsonl(outputDir, 'taskB-stall-dev.jsonl', devRows),
    writeJsonl(outputDir, 'eval-moments-stall.jsonl', evaluationRows),
  ];
  const splitsPayload = {
    schema: PROGRAM2_STALL_SPLIT_SCHEMA,
    seed: Number(splitSeed),
    fractions: SPLIT_FRACTIONS,
    byDialogue: Object.fromEntries([...splits.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
  const splitsFile = path.join(outputDir, 'splits-stall.json');
  fs.writeFileSync(splitsFile, `${JSON.stringify(splitsPayload, null, 2)}\n`);
  files.push({ name: 'splits-stall.json', rows: splits.size, sha256: sha256File(splitsFile) });

  const report = {
    schema: PROGRAM2_STALL_DATASET_REPORT_SCHEMA,
    trigger: PROGRAM2_STALL_TRIGGER,
    exploratoryUnderFloor: !corpusGatePassed,
    licensedForTraining,
    trainingProhibitedReason: licensedForTraining ? null : trainingProhibitedReasons.join('; '),
    corpusFloor: PROGRAM2_STALL_CORPUS_FLOOR,
    strictAuditPassing: audit.auditPassing,
    rawMoments: audit.rawMoments,
    sourceEligible: eligibleRows.length,
    sourceLosses,
    sourceTransformations,
    splits: {
      trainEligible: trainRows.length,
      devEligible: devRows.length,
      heldoutEligible: heldoutEligibleRows.length,
      heldoutMoments: evaluationRows.filter((row) => row.split === 'heldout').length,
    },
    freshTextAuditability: {
      deterministicDueRelease: evaluationRows.filter((row) => row.freshTextAuditability === 'deterministic_due_release')
        .length,
      requiresSemanticActionFamily: evaluationRows.filter(
        (row) => row.freshTextAuditability === 'requires_semantic_action_family',
      ).length,
    },
    archiveProvenance: audit.archives,
    files,
  };
  const reportFile = path.join(outputDir, 'stall-extraction-report.json');
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  const manifest = {
    schema: PROGRAM2_STALL_DATASET_SCHEMA,
    claimScope: 'exploratory under-floor feasibility only; does not license training',
    auditSchema: PROGRAM2_STALL_AUDIT_SCHEMA,
    splitSeed: Number(splitSeed),
    report: { name: 'stall-extraction-report.json', sha256: sha256File(reportFile) },
    ...report,
  };
  const manifestFile = path.join(outputDir, 'stall-dataset-manifest.json');
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, report, evaluationRows, eligibleRows, outputDir: path.resolve(outputDir) };
}
