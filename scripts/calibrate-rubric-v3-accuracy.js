#!/usr/bin/env node

/**
 * Authored-contrast calibration for rubric v3.0 content accuracy.
 *
 * prepare: emit blinded JSONL plus two independent human-coder CSV sheets
 * score:   score one split with a local model CLI in one bounded batch
 * analyze: compare judges, authored anchors, optional human labels, and gates
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { jsonrepair } from 'jsonrepair';
import yaml from 'yaml';

import { callModelCliText } from '../services/cliProviderBridge.js';
import { pearsonCorrelation } from '../services/rubricSensitivityAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACKET = path.join(ROOT, 'config', 'rubrics', 'v3.0', 'content-accuracy-calibration.yaml');
const DEFAULT_THRESHOLDS = path.join(ROOT, 'config', 'rubrics', 'v3.0', 'content-accuracy-promotion-thresholds.yaml');

function option(argv, name, fallback = null) {
  const flag = `--${name}`;
  const index = argv.indexOf(flag);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((value) => value.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
}

function loadYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function selectedItems(packet, split) {
  const items = packet?.items || [];
  if (split === 'all') return items;
  if (!['development', 'held_out'].includes(split)) throw new Error(`Unknown split: ${split}`);
  return items.filter((item) => item.split === split);
}

export function blindedItem(item) {
  return {
    item_id: item.id,
    domain: item.domain,
    scenario_context: item.scenario_context,
    learner_message: item.learner_message,
    tutor_turn: item.tutor_turn,
    reference_basis: item.reference_basis,
  };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildHumanLabelCsv(items, coderId) {
  const header = ['coder_id', 'item_id', 'applicability', 'content_accuracy_score', 'confidence', 'notes'];
  const rows = items.map((item) => [coderId, item.id, '', '', '', '']);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

export function buildJudgePrompt(items) {
  return `You are calibrating one narrow rubric dimension: CONTENT ACCURACY. Score every item independently using only its supplied context and reference basis.

Scale:
- 5: accurate and appropriately qualified; no material error
- 3: mostly correct, with a minor error, omission, or simplification that does not overturn the teaching move
- 1: major error, false attribution, unsupported certainty, or distortion that would materially mislead
- You may use 2 or 4 for genuine intermediate cases.
- If and only if the tutor turn makes no assessable factual or domain claim, return score=null and not_applicable=true. Never use 5 as a substitute for N/A.
- A contested interpretation is not an error when the turn identifies it as an interpretation and qualifies it appropriately.
- Judge content only, not warmth, pedagogy, length, or style.

Return one result for every item_id. Keep each reasoning under 25 words. Respond with only JSON in this form:
{
  "scores": [
    {"item_id":"example", "score":5, "not_applicable":false, "reasoning":"Accurate and qualified"}
  ]
}

ITEMS:
${JSON.stringify(items.map(blindedItem), null, 2)}`;
}

function parseJsonResponse(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Judge returned an empty response');
  const candidates = [];
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)) candidates.push(match[1]);
  candidates.push(text);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates.reverse()) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(jsonrepair(candidate));
      } catch {
        // Try the next candidate.
      }
    }
  }
  throw new Error(`Could not parse judge JSON: ${text.slice(0, 240)}`);
}

function normalizeScore(value) {
  if (value?.not_applicable === true) {
    return {
      item_id: value.item_id,
      score: null,
      not_applicable: true,
      reasoning: value.reasoning || null,
    };
  }
  const score = typeof value?.score === 'number' ? value.score : Number(value?.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error(`Invalid applicable score for ${value?.item_id || '(missing item id)'}`);
  }
  return {
    item_id: value.item_id,
    score,
    not_applicable: false,
    reasoning: value.reasoning || null,
  };
}

export function normalizeJudgeOutput(parsed, items) {
  const rawScores = Array.isArray(parsed?.scores) ? parsed.scores : Array.isArray(parsed) ? parsed : null;
  if (!rawScores) throw new Error('Judge JSON must contain a scores array');
  const byId = new Map(rawScores.map((score) => [score.item_id, normalizeScore(score)]));
  const missing = items.map((item) => item.id).filter((id) => !byId.has(id));
  const extras = [...byId.keys()].filter((id) => !items.some((item) => item.id === id));
  if (missing.length || extras.length) {
    throw new Error(`Judge item mismatch: missing=[${missing.join(',')}], extras=[${extras.join(',')}]`);
  }
  return items.map((item) => byId.get(item.id));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function agreementMetrics(left, right) {
  const pairs = left
    .map((value, index) => ({ left: value, right: right[index] }))
    .filter((pair) => pair.left && pair.right);
  const applicabilityMatches = pairs.filter((pair) => pair.left.not_applicable === pair.right.not_applicable).length;
  const applicable = pairs.filter((pair) => !pair.left.not_applicable && !pair.right.not_applicable);
  const differences = applicable.map((pair) => Math.abs(pair.left.score - pair.right.score));
  return {
    n_items: pairs.length,
    applicability_agreement: pairs.length ? applicabilityMatches / pairs.length : null,
    n_both_applicable: applicable.length,
    applicable_exact_agreement: applicable.length
      ? applicable.filter((pair) => pair.left.score === pair.right.score).length / applicable.length
      : null,
    applicable_within_one: differences.length
      ? differences.filter((difference) => difference <= 1).length / differences.length
      : null,
    applicable_mae: mean(differences),
    applicable_pearson_r: pearsonCorrelation(
      applicable.map((pair) => pair.left.score),
      applicable.map((pair) => pair.right.score),
    ),
  };
}

function authoredScores(items) {
  return items.map((item) => ({
    item_id: item.id,
    score: item.expected_score,
    not_applicable: item.expected_applicability === 'not_applicable',
  }));
}

function thresholdChecks(metrics, thresholds, prefix) {
  const checks = [];
  const add = (name, value, threshold, comparator) => {
    const passed = value != null && (comparator === 'min' ? value >= threshold : value <= threshold);
    checks.push({ name: `${prefix}.${name}`, value, comparator, threshold, passed });
  };
  add('applicability_agreement', metrics.applicability_agreement, thresholds.applicability_agreement_min, 'min');
  add('applicable_pearson_r', metrics.applicable_pearson_r, thresholds.applicable_pearson_r_min, 'min');
  add('applicable_mae', metrics.applicable_mae, thresholds.applicable_mae_max, 'max');
  add('applicable_within_one', metrics.applicable_within_one, thresholds.applicable_within_one_min, 'min');
  return checks;
}

function authoredThresholdChecks(metrics, thresholds, prefix) {
  return thresholdChecks(
    metrics,
    {
      applicability_agreement_min: thresholds.applicability_accuracy_min,
      applicable_pearson_r_min: thresholds.applicable_pearson_r_min,
      applicable_mae_max: thresholds.applicable_mae_max,
      applicable_within_one_min: thresholds.applicable_within_one_min,
    },
    prefix,
  );
}

function humanCalibration(items, artifacts, humanLabelSets, thresholds) {
  const nonAdjudicators = humanLabelSets.filter(
    (labels) =>
      !String(labels[0]?.coder_id || '')
        .toLowerCase()
        .includes('adjudicat'),
  );
  const explicitAdjudication = humanLabelSets.find((labels) =>
    String(labels[0]?.coder_id || '')
      .toLowerCase()
      .includes('adjudicat'),
  );
  const byCoder = nonAdjudicators.map((labels) => {
    const byId = new Map(labels.map((label) => [label.item_id, normalizeScore(label)]));
    return items.map((item) => byId.get(item.id) || null);
  });
  const coderPairs = [];
  for (let left = 0; left < byCoder.length; left += 1) {
    for (let right = left + 1; right < byCoder.length; right += 1) {
      coderPairs.push({ left, right, metrics: agreementMetrics(byCoder[left], byCoder[right]) });
    }
  }

  let anchor;
  if (explicitAdjudication) {
    const byId = new Map(explicitAdjudication.map((label) => [label.item_id, normalizeScore(label)]));
    anchor = items.map((item) => byId.get(item.id) || null);
  } else {
    anchor = items.map((_item, index) => {
      const labels = byCoder.map((coder) => coder[index]).filter(Boolean);
      if (labels.length < thresholds.independent_coders_min) return null;
      const first = labels[0];
      return labels.every((label) => label.not_applicable === first.not_applicable && label.score === first.score)
        ? first
        : null;
    });
  }

  const machineVsHuman = artifacts.map((artifact) => ({
    judge: artifact.judge,
    metrics: agreementMetrics(artifact.scores, anchor),
  }));
  const checks = [
    {
      name: 'human.independent_coders',
      value: nonAdjudicators.length,
      comparator: 'min',
      threshold: thresholds.independent_coders_min,
      passed: nonAdjudicators.length >= thresholds.independent_coders_min,
    },
  ];
  for (const [index, pair] of coderPairs.entries()) {
    checks.push(
      {
        name: `human.coder_pair.${index}.applicability_agreement`,
        value: pair.metrics.applicability_agreement,
        comparator: 'min',
        threshold: thresholds.coder_applicability_agreement_min,
        passed:
          pair.metrics.applicability_agreement != null &&
          pair.metrics.applicability_agreement >= thresholds.coder_applicability_agreement_min,
      },
      {
        name: `human.coder_pair.${index}.applicable_within_one`,
        value: pair.metrics.applicable_within_one,
        comparator: 'min',
        threshold: thresholds.coder_applicable_within_one_min,
        passed:
          pair.metrics.applicable_within_one != null &&
          pair.metrics.applicable_within_one >= thresholds.coder_applicable_within_one_min,
      },
    );
  }
  const completeAnchors = anchor.filter(Boolean).length;
  checks.push({
    name: 'human.complete_anchor_items',
    value: completeAnchors,
    comparator: 'min',
    threshold: items.length,
    passed: completeAnchors === items.length,
  });
  for (const result of machineVsHuman) {
    checks.push(
      ...thresholdChecks(
        result.metrics,
        {
          applicability_agreement_min: thresholds.machine_human_applicability_agreement_min,
          applicable_pearson_r_min: thresholds.machine_human_applicable_pearson_r_min,
          applicable_mae_max: thresholds.machine_human_applicable_mae_max,
          applicable_within_one_min: thresholds.machine_human_applicable_within_one_min,
        },
        `human.machine.${result.judge?.label || result.judge?.provider || 'judge'}`,
      ),
    );
  }
  return {
    independent_coders: nonAdjudicators.length,
    used_explicit_adjudication: Boolean(explicitAdjudication),
    complete_anchor_items: completeAnchors,
    coder_pairs: coderPairs,
    machine_vs_human: machineVsHuman,
    checks,
    gates_pass: checks.length > 0 && checks.every((check) => check.passed),
  };
}

export function analyzeAccuracyCalibration({ items, artifacts, thresholds, humanLabelSets = [] }) {
  const expectedIds = items.map((item) => item.id);
  const normalizedArtifacts = artifacts.map((artifact) => {
    const byId = new Map((artifact.scores || []).map((score) => [score.item_id, normalizeScore(score)]));
    const scores = expectedIds.map((id) => byId.get(id));
    if (scores.some((score) => !score)) throw new Error(`Artifact ${artifact.judge?.label || 'unknown'} is incomplete`);
    return { ...artifact, scores };
  });
  const expected = authoredScores(items);
  const authored = normalizedArtifacts.map((artifact) => ({
    judge: artifact.judge,
    metrics: agreementMetrics(artifact.scores, expected),
  }));
  const crossJudge = [];
  for (let left = 0; left < normalizedArtifacts.length; left += 1) {
    for (let right = left + 1; right < normalizedArtifacts.length; right += 1) {
      crossJudge.push({
        left_judge: normalizedArtifacts[left].judge,
        right_judge: normalizedArtifacts[right].judge,
        metrics: agreementMetrics(normalizedArtifacts[left].scores, normalizedArtifacts[right].scores),
      });
    }
  }
  const checks = [
    ...authored.flatMap((result) =>
      authoredThresholdChecks(
        result.metrics,
        thresholds.authored_contrast,
        `authored.${result.judge?.label || result.judge?.provider || 'judge'}`,
      ),
    ),
    ...crossJudge.flatMap((result, index) =>
      thresholdChecks(result.metrics, thresholds.machine_same_item, `cross_judge.${index}`),
    ),
  ];
  const human = humanLabelSets.length
    ? humanCalibration(items, normalizedArtifacts, humanLabelSets, thresholds.human_anchor)
    : {
        independent_coders: 0,
        complete_anchor_items: 0,
        coder_pairs: [],
        machine_vs_human: [],
        checks: [],
        gates_pass: false,
      };
  const machineGatesPass = checks.length > 0 && checks.every((check) => check.passed);
  return {
    n_items: items.length,
    authored,
    cross_judge: crossJudge,
    checks,
    machine_gates_pass: machineGatesPass,
    human,
    promotion_ready: machineGatesPass && human.gates_pass,
    promotion_blocker:
      machineGatesPass && human.gates_pass
        ? null
        : 'All machine gates plus two independent human coders and a complete agreed/adjudicated anchor are required.',
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/u, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])));
}

export function loadHumanLabels(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'))
    .filter((row) => row.applicability)
    .map((row) => {
      if (!['applicable', 'not_applicable'].includes(row.applicability)) {
        throw new Error(`Invalid applicability for ${row.item_id}`);
      }
      const score = row.applicability === 'not_applicable' ? null : Number(row.content_accuracy_score);
      if (score != null && (!Number.isInteger(score) || score < 1 || score > 5)) {
        throw new Error(`Invalid human score for ${row.item_id}`);
      }
      return {
        coder_id: row.coder_id,
        item_id: row.item_id,
        not_applicable: row.applicability === 'not_applicable',
        score,
        confidence: row.confidence ? Number(row.confidence) : null,
        notes: row.notes || null,
      };
    });
}

function prepare(packetPath, split, outDir) {
  const packet = loadYaml(packetPath);
  const items = selectedItems(packet, split);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${split}-items.blinded.jsonl`),
    items.map((item) => JSON.stringify(blindedItem(item))).join('\n') + '\n',
  );
  fs.writeFileSync(path.join(outDir, `${split}-human-labels-coder-a.csv`), buildHumanLabelCsv(items, 'coder-a'));
  fs.writeFileSync(path.join(outDir, `${split}-human-labels-coder-b.csv`), buildHumanLabelCsv(items, 'coder-b'));
  fs.writeFileSync(
    path.join(outDir, `${split}-labelling-instructions.md`),
    `# Rubric v3.0 content-accuracy labels: ${split}\n\nLabel independently before viewing model scores. Use \`applicable\` or \`not_applicable\`. For applicable items, assign an integer 1-5 using the supplied reference basis. Use N/A only when the tutor makes no assessable factual or domain claim. Confidence is 1-5. Do not discuss labels until both coder sheets are complete; adjudicate disagreements in a copied third sheet.\n`,
  );
  console.log(`Prepared ${items.length} blinded ${split} items in ${outDir}`);
}

async function score(packetPath, split, argv) {
  const packet = loadYaml(packetPath);
  const items = selectedItems(packet, split);
  const cli = option(argv, 'judge-cli');
  if (!['codex', 'claude'].includes(cli)) throw new Error('--judge-cli must be codex or claude');
  const provider = cli === 'claude' ? 'claude-code' : 'codex';
  const model = option(argv, 'model');
  const effort = option(argv, 'effort', 'medium');
  const raw = await callModelCliText({
    provider,
    model,
    effort,
    prompt: buildJudgePrompt(items),
    role: 'rubric-v3-content-accuracy-calibration',
  });
  const scores = normalizeJudgeOutput(parseJsonResponse(raw), items);
  const artifact = {
    schema: 'machinespirits.rubric-v3.content-accuracy-scores.v1',
    created_at: new Date().toISOString(),
    packet_version: packet.version,
    rubric_version: packet.rubric_version,
    split,
    judge: { label: `${provider}/${model || 'default'}@${effort}`, provider, model: model || null, effort },
    scores,
  };
  const output = option(
    argv,
    'out',
    path.join(ROOT, 'exports', 'rubric-v3-calibration', `${split}-${provider}-${model || 'default'}-${effort}.json`),
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n');
  console.log(`Scored ${scores.length} ${split} items with ${artifact.judge.label}: ${output}`);
}

function analyze(packetPath, split, argv) {
  const packet = loadYaml(packetPath);
  const items = selectedItems(packet, split);
  const scoreFiles = (option(argv, 'scores', '') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (scoreFiles.length < 2) throw new Error('analyze requires at least two comma-separated --scores artifacts');
  const thresholdsPath = option(argv, 'thresholds', DEFAULT_THRESHOLDS);
  const thresholds = loadYaml(thresholdsPath);
  const artifacts = scoreFiles.map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')));
  const humanFiles = (option(argv, 'human', '') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const humanLabelSets = humanFiles.map((filePath) => loadHumanLabels(filePath));
  const report = {
    schema: 'machinespirits.rubric-v3.content-accuracy-analysis.v1',
    created_at: new Date().toISOString(),
    split,
    packet_version: packet.version,
    threshold_version: thresholds.version,
    ...analyzeAccuracyCalibration({ items, artifacts, thresholds, humanLabelSets }),
    human_label_files: humanFiles,
  };
  const output = option(argv, 'out');
  const rendered = JSON.stringify(report, null, 2) + '\n';
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, rendered);
    console.log(`Analysis written: ${output}`);
  } else process.stdout.write(rendered);
}

function usage() {
  console.log(`Usage:
  node scripts/calibrate-rubric-v3-accuracy.js prepare --split <development|held_out> [--out-dir <dir>]
  node scripts/calibrate-rubric-v3-accuracy.js score --split <development|held_out> --judge-cli <claude|codex> --model <model> --effort medium [--out <json>]
  node scripts/calibrate-rubric-v3-accuracy.js analyze --split <development|held_out> --scores <claude.json,codex.json> [--human <coder-a.csv,coder-b.csv>] [--out <json>]
`);
}

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!command || argv.includes('--help') || argv.includes('-h')) {
    usage();
    return 0;
  }
  const packetPath = option(argv, 'packet', DEFAULT_PACKET);
  const split = option(argv, 'split', 'development');
  if (command === 'prepare') {
    prepare(
      packetPath,
      split,
      option(argv, 'out-dir', path.join(ROOT, 'exports', 'rubric-v3-calibration', 'human-labelling')),
    );
    return 0;
  }
  if (command === 'score') {
    await score(packetPath, split, argv);
    return 0;
  }
  if (command === 'analyze') {
    analyze(packetPath, split, argv);
    return 0;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`Rubric v3 accuracy calibration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
