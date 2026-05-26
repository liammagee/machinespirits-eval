#!/usr/bin/env node
/**
 * Ingest poetics/drama artifacts into sidecar tables.
 *
 * This intentionally does NOT write `evaluation_results`. The poetics artifacts
 * are calibration objects: public samples, held-out keys, full traces, critic
 * scores, and optional labels-as-perspective.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import yaml from 'yaml';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsLabel,
  upsertPoeticsRun,
  upsertPoeticsScore,
} from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CONTROL_ROLES = new Map([
  ['d4-flat', 'flat_control'],
  ['d10-emphatic-trap', 'boundary_trap_control'],
  ['d10-boundary-trap', 'boundary_trap_control'],
  ['d25-hard-trap', 'hard_trap_control'],
  ['d26-hard-trap', 'hard_trap_control'],
]);

function parseArgs(argv) {
  const args = {
    rootDir: null,
    runId: null,
    dbPath: null,
    labels: [],
    labelsKey: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root-dir') args.rootDir = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--labels') args.labels.push(path.resolve(argv[++i]));
    else if (token === '--labels-key') args.labelsKey = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/ingest-poetics-artifacts.js --root-dir DIR [--run-id ID] [--db FILE]
      [--labels FILE ...] [--labels-key KEY.yaml] [--dry-run]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.rootDir) throw new Error('--root-dir is required');
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8')) || {};
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hashFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gitCommit() {
  const res = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

function loadBatchPlan(rootDir) {
  const planPath = path.join(rootDir, 'batch-plan.json');
  if (!fs.existsSync(planPath)) {
    throw new Error(`missing batch plan: ${planPath}`);
  }
  return readJson(planPath);
}

function unitKeyContexts(unit) {
  const keyPath = absFromRoot(unit.keyPath);
  if (unit.pairedPolicies) {
    const contexts = unit.pairedPolicies.map((policy) => ({
      unit,
      arm: policy,
      keyPath: path.join(path.dirname(keyPath), `key-${policy}.yaml`),
      sampleDir: path.join(absFromRoot(unit.outDir), policy),
      transcriptsDir: path.join(absFromRoot(unit.transcriptsDir), policy),
    }));
    const prefixKeyPath = path.join(path.dirname(keyPath), 'key-prefix-baseline.yaml');
    if (fs.existsSync(prefixKeyPath) && !unit.pairedPolicies.includes('prefix-baseline')) {
      contexts.push({
        unit,
        arm: 'prefix-baseline',
        keyPath: prefixKeyPath,
        sampleDir: path.join(absFromRoot(unit.outDir), 'prefix-baseline'),
        transcriptsDir: path.join(absFromRoot(unit.transcriptsDir), 'prefix-baseline'),
      });
    }
    return contexts;
  }
  return [
    {
      unit,
      arm: null,
      keyPath,
      sampleDir: absFromRoot(unit.outDir),
      transcriptsDir: absFromRoot(unit.transcriptsDir),
    },
  ];
}

function fullTranscriptPath(transcriptsDir, tid) {
  const candidate = path.join(transcriptsDir, `${tid}.full.md`);
  return fs.existsSync(candidate) ? candidate : null;
}

function controlRole(unit, item) {
  if (unit.kind !== 'control') return null;
  if (CONTROL_ROLES.has(unit.control)) return CONTROL_ROLES.get(unit.control);
  if (String(item.intended_lean || '').includes('trap')) return 'trap_control';
  return 'control';
}

function buildIngestPlan({ rootDir, runId = null, labels = [], labelsKey = null }) {
  const plan = loadBatchPlan(rootDir);
  const id = runId || plan.batchId || path.basename(rootDir);
  const keyContexts = [];
  const items = [];
  const itemByKeyTid = new Map();
  const itemIdsByTid = new Map();

  for (const unit of plan.units || []) {
    for (const context of unitKeyContexts(unit)) {
      if (!fs.existsSync(context.keyPath)) continue;
      const key = readYaml(context.keyPath);
      keyContexts.push(context);
      for (const [tid, keyItem] of Object.entries(key.items || {})) {
        const samplePath = path.join(context.sampleDir, `${tid}.txt`);
        const itemId = `${id}:${unit.id}:${context.arm || 'default'}:${tid}`;
        const item = {
          id: itemId,
          runId: id,
          unitId: unit.id,
          repeat: unit.repeat || null,
          arm: context.arm || 'default',
          tid,
          dramaId: keyItem.drama_id || null,
          discipline: keyItem.discipline || null,
          condition: keyItem.condition || null,
          intendedLean: keyItem.intended_lean || null,
          controlFamily: unit.control || null,
          controlRole: controlRole(unit, keyItem),
          samplePath: fs.existsSync(samplePath) ? rel(samplePath) : null,
          fullTranscriptPath: fullTranscriptPath(context.transcriptsDir, tid)
            ? rel(fullTranscriptPath(context.transcriptsDir, tid))
            : null,
          keyPath: rel(context.keyPath),
          qualityStatus: keyItem.quality_status || null,
          qualityWarnings: keyItem.quality_warnings || [],
          contentHash: hashFile(samplePath),
          metadata: { unit, keyItem },
        };
        items.push(item);
        const keyTid = `${rel(context.keyPath)}:${tid}`;
        itemByKeyTid.set(keyTid, itemId);
        if (!itemIdsByTid.has(tid)) itemIdsByTid.set(tid, []);
        itemIdsByTid.get(tid).push(itemId);
      }
    }
  }

  const scores = [];
  const scoreDir = path.join(rootDir, 'scores');
  if (fs.existsSync(scoreDir)) {
    for (const filename of fs
      .readdirSync(scoreDir)
      .filter((file) => file.endsWith('.json'))
      .sort()) {
      const scorePath = path.join(scoreDir, filename);
      const artifact = readJson(scorePath);
      const keyRel = artifact.qualityPolicy?.key;
      if (!keyRel) continue;
      for (const row of artifact.scored || []) {
        const itemId =
          itemByKeyTid.get(`${keyRel}:${row.id}`) || itemByKeyTid.get(`${rel(absFromRoot(keyRel))}:${row.id}`);
        if (!itemId) continue;
        scores.push({
          itemId,
          criticModel: artifact.critic || 'unknown',
          scoreFile: rel(scorePath),
          formClass: row.formClass || null,
          recontextualization: row.recontextualization ?? null,
          statedInsight: row.statedInsight ?? null,
          rupture: row.rupture ?? null,
          globalCoherence: row.globalCoherence ?? null,
          pivotLearnerTurn: row.pivotLearnerTurn ?? null,
          recoheredEarlier: row.recoheredEarlier ?? null,
          statedInsightEvidence: row.statedInsightEvidence ?? null,
          errorMessage: row.error || null,
          flags: row.flags || [],
          metadata: {
            scoreId: row.id,
            learning_signal_class: row.learningSignalClass ?? null,
            actional_breakthrough: row.actionalBreakthrough ?? null,
            actional_breakthrough_learner_turn: row.actionalBreakthroughLearnerTurn ?? null,
            actional_breakthrough_evidence: row.actionalBreakthroughEvidence ?? null,
            actional_breakthrough_justification: row.actionalBreakthroughJustification ?? null,
            rawScores: row.rawScores || null,
            role_symmetric_scores: row.roleSymmetricScores || null,
            reversal_trigger_learner_turn: row.reversalTriggerLearnerTurn ?? null,
            tutor_strategic_reversal: row.tutorStrategicReversal ?? null,
            tutor_adaptive_mechanism: row.tutorAdaptiveMechanism ?? row.tutorStrategicReversal ?? null,
            tutor_reversal_evidence: row.tutorReversalEvidence ?? null,
            tutor_reversal_justification: row.tutorReversalJustification ?? null,
            adaptive_mechanism_quality: row.adaptiveMechanismQuality ?? null,
            adaptive_mechanism_quality_evidence: row.adaptiveMechanismQualityEvidence ?? null,
            adaptive_mechanism_quality_justification: row.adaptiveMechanismQualityJustification ?? null,
            tutor_contingent_adaptation: row.tutorContingentAdaptation ?? null,
            tutor_adaptation_evidence: row.tutorAdaptationEvidence ?? null,
            tutor_adaptation_justification: row.tutorAdaptationJustification ?? null,
          },
        });
      }
    }
  }

  const labelRows = [];
  for (const labelsPath of labels) {
    const labelDoc = readYaml(labelsPath);
    const labelKeyRel = labelsKey ? rel(labelsKey) : null;
    for (const [tid, label] of Object.entries(labelDoc.labels || {})) {
      const itemIds = labelKeyRel
        ? [itemByKeyTid.get(`${labelKeyRel}:${tid}`)].filter(Boolean)
        : itemIdsByTid.get(tid) || [];
      if (itemIds.length !== 1) continue;
      labelRows.push({
        itemId: itemIds[0],
        labellerId: labelDoc.labeller || path.basename(labelsPath, path.extname(labelsPath)),
        perspective: labelDoc.perspective || 'human',
        labelFile: rel(labelsPath),
        formClass: label.label,
        pivotLearnerTurn: label.pivot_learner_turn ?? null,
        rationale: label.note ?? null,
        labelledAt: label.labelled_at ?? null,
        metadata: { rubricVersion: labelDoc.rubric_version || null },
      });
    }
  }

  return {
    run: {
      id,
      sourceRoot: rel(rootDir),
      batchId: plan.batchId || id,
      generator: plan.generator || null,
      generatorModel: null,
      specPath: plan.units?.[0]?.spec || null,
      keyPath: keyContexts[0] ? rel(keyContexts[0].keyPath) : null,
      gitCommit: gitCommit(),
      metadata: {
        repeats: plan.repeats ?? null,
        stressRepeats: plan.stressRepeats ?? null,
        maxTurns: plan.maxTurns ?? null,
        critics: plan.critics || [],
        units: plan.units || [],
      },
    },
    items,
    scores,
    labels: labelRows,
  };
}

function persistIngestPlan(db, plan) {
  const tx = db.transaction(() => {
    upsertPoeticsRun(db, plan.run);
    for (const item of plan.items) upsertPoeticsItem(db, item);
    for (const score of plan.scores) upsertPoeticsScore(db, score);
    for (const label of plan.labels) upsertPoeticsLabel(db, label);
  });
  tx();
}

function summarize(plan) {
  return {
    runId: plan.run.id,
    items: plan.items.length,
    scores: plan.scores.length,
    labels: plan.labels.length,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = buildIngestPlan(args);
  if (!args.dryRun) {
    const db = openPoeticsStore(args.dbPath || undefined);
    try {
      persistIngestPlan(db, plan);
    } finally {
      db.close();
    }
  }
  const summary = summarize(plan);
  console.log(
    `${args.dryRun ? 'would ingest' : 'ingested'} poetics run ${summary.runId}: ` +
      `${summary.items} items, ${summary.scores} scores, ${summary.labels} labels`,
  );
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { buildIngestPlan, persistIngestPlan };
