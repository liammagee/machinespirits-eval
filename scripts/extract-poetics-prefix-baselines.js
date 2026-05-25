#!/usr/bin/env node
/**
 * Extract pre-branch prefix transcripts from paired poetics runs.
 *
 * The purpose is a baseline-risk screen: if a transcript is already scored as
 * recognition before the branch-specific revisit/peripeteia machinery appears,
 * the scenario should be treated as an organic-reversal boundary item rather
 * than as a clean negative control.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { parseTurns } from './score-poetics-phase2.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    rootDir: null,
    unitId: 'target-r01',
    sourceArm: 'routine',
    arm: 'prefix-baseline',
    throughTutorTurn: 2,
    updatePlan: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root-dir') args.rootDir = path.resolve(argv[++i]);
    else if (token === '--unit-id') args.unitId = argv[++i];
    else if (token === '--source-arm') args.sourceArm = argv[++i];
    else if (token === '--arm') args.arm = argv[++i];
    else if (token === '--through-tutor-turn') args.throughTutorTurn = Number(argv[++i]);
    else if (token === '--no-update-plan') args.updatePlan = false;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/extract-poetics-prefix-baselines.js --root-dir DIR
      [--unit-id target-r01] [--source-arm routine] [--arm prefix-baseline]
      [--through-tutor-turn 2] [--no-update-plan]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.rootDir) throw new Error('--root-dir is required');
  if (!Number.isInteger(args.throughTutorTurn) || args.throughTutorTurn < 1) {
    throw new Error('--through-tutor-turn must be a positive integer');
  }
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function loadBatchPlan(rootDir) {
  const planPath = path.join(rootDir, 'batch-plan.json');
  if (!fs.existsSync(planPath)) throw new Error(`missing batch plan: ${planPath}`);
  return { planPath, plan: JSON.parse(fs.readFileSync(planPath, 'utf8')) };
}

function dirsForUnitArm(unit, arm) {
  const outDir = absFromRoot(unit.outDir);
  const delibDir = absFromRoot(unit.delibDir);
  const transcriptsDir = absFromRoot(unit.transcriptsDir);
  const keyPath = absFromRoot(unit.keyPath);
  return {
    sampleDir: path.join(outDir, arm),
    delibDir: path.join(delibDir, arm),
    transcriptsDir: path.join(transcriptsDir, arm),
    keyPath: path.join(path.dirname(keyPath), `key-${arm}.yaml`),
  };
}

function prefixThroughTutorTurn(turns, throughTutorTurn) {
  const out = [];
  let tutorTurns = 0;
  for (const turn of turns) {
    out.push(turn);
    if (turn.role === 'TUTOR') {
      tutorTurns += 1;
      if (tutorTurns === throughTutorTurn) return out;
    }
  }
  throw new Error(`transcript has fewer than ${throughTutorTurn} tutor turn(s)`);
}

function countRole(turns, role) {
  return turns.filter((turn) => turn.role === role).length;
}

function renderTurns(turns) {
  return `${turns.map((turn) => `${turn.role}: ${turn.text}`).join('\n\n')}\n`;
}

function extractPrefixBaselines(args) {
  const { planPath, plan } = loadBatchPlan(args.rootDir);
  const unit = (plan.units || []).find((candidate) => candidate.id === args.unitId);
  if (!unit) throw new Error(`unit not found in batch plan: ${args.unitId}`);
  const source = dirsForUnitArm(unit, args.sourceArm);
  const target = dirsForUnitArm(unit, args.arm);
  if (!fs.existsSync(source.sampleDir)) throw new Error(`missing source sample dir: ${source.sampleDir}`);
  if (!fs.existsSync(source.keyPath)) throw new Error(`missing source key: ${source.keyPath}`);

  const sourceKey = yaml.parse(fs.readFileSync(source.keyPath, 'utf8')) || {};
  const key = {
    ...sourceKey,
    generated: new Date().toISOString(),
    prefix_baseline: true,
    prefix_source_arm: args.sourceArm,
    prefix_through: `tutor_turn_${args.throughTutorTurn}`,
    tutor_adaptation_policy: 'prefix-baseline',
    director_revisit_cue: false,
    director_revisit_policy: 'none',
    director_revisit_anchor: null,
    transcripts_dir: rel(target.transcriptsDir),
    items: {},
  };

  fs.mkdirSync(target.sampleDir, { recursive: true });
  fs.mkdirSync(target.transcriptsDir, { recursive: true });

  for (const [tid, item] of Object.entries(sourceKey.items || {})) {
    const sourceSample = path.join(source.sampleDir, `${tid}.txt`);
    if (!fs.existsSync(sourceSample)) continue;
    const turns = prefixThroughTutorTurn(parseTurns(fs.readFileSync(sourceSample, 'utf8')), args.throughTutorTurn);
    const transcript = renderTurns(turns);
    fs.writeFileSync(path.join(target.sampleDir, `${tid}.txt`), transcript, 'utf8');
    fs.writeFileSync(path.join(target.transcriptsDir, `${tid}.public.txt`), transcript, 'utf8');
    key.items[tid] = {
      ...item,
      source_tid: tid,
      source_arm: args.sourceArm,
      prefix_baseline: true,
      prefix_through: key.prefix_through,
      tutor_adaptation_policy: 'prefix-baseline',
      director_revisit_cue: false,
      director_revisit_policy: 'none',
      director_revisit_anchor: null,
      n_tutor_turns: countRole(turns, 'TUTOR'),
      n_learner_turns: countRole(turns, 'LEARNER'),
      quality_status: 'ok',
      quality_warnings: [],
    };
  }
  key.n = Object.keys(key.items).length;
  key.quality_warning_count = 0;
  key.quality_blocking_warning_count = 0;
  fs.writeFileSync(target.keyPath, yaml.stringify(key), 'utf8');

  if (args.updatePlan) {
    unit.pairedPolicies = [...new Set([...(unit.pairedPolicies || []), args.arm])];
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  }

  return {
    arm: args.arm,
    sourceArm: args.sourceArm,
    n: key.n,
    sampleDir: rel(target.sampleDir),
    keyPath: rel(target.keyPath),
    updatedPlan: args.updatePlan ? rel(planPath) : null,
  };
}

function main() {
  const summary = extractPrefixBaselines(parseArgs(process.argv.slice(2)));
  console.log(
    `extracted ${summary.n} prefix baseline transcript(s) from ${summary.sourceArm} to ${summary.arm}\n` +
      `sample: ${summary.sampleDir}\nkey: ${summary.keyPath}` +
      (summary.updatedPlan ? `\nupdated batch plan: ${summary.updatedPlan}` : ''),
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

export { extractPrefixBaselines, prefixThroughTutorTurn, renderTurns };
