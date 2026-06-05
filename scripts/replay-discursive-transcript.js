#!/usr/bin/env node
/**
 * Offline discursive replay / counterfactual revision harness.
 *
 * Reads an existing public transcript (optionally with held-out inner state and
 * key metadata), performs ONE bounded rewrite pass through a selected CLI, and
 * optionally asks a second CLI to smoke-check the revised copy against the
 * discursive-game/accountable-scorekeeping criteria.
 *
 * This is deliberately not an online tutor run and not an OpenRouter critic
 * panel. It writes a counterfactual artifact bundle and leaves originals/DB rows
 * unchanged.
 *
 * Usage:
 *   node scripts/replay-discursive-transcript.js --mock --transcript path/to/T15.full.md
 *   node scripts/replay-discursive-transcript.js --item-id '<poetics_items.id>' --generator codex --checker claude
 *   node scripts/replay-discursive-transcript.js --run-id phase2-low-organic-cleaner-adaptation-v2 --limit 3 --generator codex --checker agy
 */

import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import yaml from 'yaml';
import { jsonrepair } from 'jsonrepair';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');
const DEFAULT_TIMEOUT_MS = 360_000;
const DEFAULT_AGY_TIMEOUT_MS = 600_000;
const DEFAULT_CODEX_EFFORT = process.env.CODEX_REASONING_EFFORT || 'xhigh';
const DEFAULT_AGY_BIN = process.env.AGY_BIN || path.join(os.homedir(), '.local/bin/agy');

const BACKENDS = new Set(['mock', 'codex', 'claude', 'agy', 'none', 'adversarial']);
const DEFAULT_GATE_THRESHOLDS = Object.freeze({
  public_evidence: 0.7,
  tactic_selection: 0.7,
  learner_actional_uptake: 0.7,
  learner_self_reframe: 0.7,
  dyadic_revision: 0.7,
  non_leakage: 0.9,
  prose_preservation: 0.5,
});
const GATE_SCORE_KEYS = Object.freeze(Object.keys(DEFAULT_GATE_THRESHOLDS));
const REVISION_ONLY_GATE_SCORE_KEYS = new Set(['learner_self_reframe']);

function usage() {
  return `Usage:
  node scripts/replay-discursive-transcript.js [--mock]
    (--item-id <id>[,<id>...] | --run-id <runId> [--limit N] | --transcript <path>)
    [--key <path>] [--out-dir <dir>]
    [--generator mock|codex|claude|agy|gemini]
    [--checker none|mock|codex|claude|agy|gemini|adversarial]
    [--adversarial-check]
    [--no-local-gate]
    [--min-public-evidence N] [--min-tactic-selection N]
    [--min-learner-actional-uptake N] [--min-learner-self-reframe N]
    [--min-dyadic-revision N]
    [--min-non-leakage N] [--min-prose-preservation N]
    [--timeout-ms N] [--force] [--dry-run]

Defaults are cost-safe: --generator mock --checker none.
Use --checker adversarial to default to claude for codex rewrites, and codex for claude rewrites.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    db: DEFAULT_DB_PATH,
    itemIds: [],
    runId: null,
    transcript: null,
    key: null,
    limit: 1,
    outDir: null,
    generator: 'mock',
    checker: 'none',
    checkerPolicy: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    codexEffort: DEFAULT_CODEX_EFFORT,
    codexModel: process.env.CODEX_MODEL || null,
    claudeModel: process.env.CLAUDE_CODE_MODEL || null,
    claudeEffort: process.env.CLAUDE_CODE_EFFORT || null,
    agyBin: DEFAULT_AGY_BIN,
    agyModelLabel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    localGate: true,
    gateThresholds: { ...DEFAULT_GATE_THRESHOLDS },
    publicMaxChars: 30_000,
    innerMaxChars: 18_000,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') {
      args.help = true;
    } else if (t === '--mock') {
      args.generator = 'mock';
      if (args.checker === 'none') args.checker = 'mock';
    } else if (t === '--db') args.db = path.resolve(argv[++i]);
    else if (t === '--item-id') args.itemIds.push(...splitList(argv[++i]));
    else if (t === '--run-id') args.runId = argv[++i];
    else if (t === '--transcript') args.transcript = path.resolve(argv[++i]);
    else if (t === '--key') args.key = path.resolve(argv[++i]);
    else if (t === '--limit') args.limit = Number(argv[++i]);
    else if (t === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (t === '--generator') args.generator = normalizeBackend(argv[++i]);
    else if (t === '--checker') args.checker = normalizeBackend(argv[++i]);
    else if (t === '--adversarial-check') {
      args.checker = 'adversarial';
      args.checkerPolicy = 'adversarial';
    }
    else if (t === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (t === '--codex-effort') args.codexEffort = argv[++i];
    else if (t === '--codex-model') args.codexModel = argv[++i];
    else if (t === '--claude-model') args.claudeModel = argv[++i];
    else if (t === '--claude-effort') args.claudeEffort = argv[++i];
    else if (t === '--agy-bin') args.agyBin = path.resolve(argv[++i]);
    else if (t === '--agy-model-label') args.agyModelLabel = argv[++i];
    else if (t === '--no-local-gate') args.localGate = false;
    else if (t === '--min-public-evidence') args.gateThresholds.public_evidence = Number(argv[++i]);
    else if (t === '--min-tactic-selection') args.gateThresholds.tactic_selection = Number(argv[++i]);
    else if (
      t === '--min-learner-uptake' ||
      t === '--min-learner-uptake-or-contest' ||
      t === '--min-learner-actional-uptake'
    ) {
      args.gateThresholds.learner_actional_uptake = Number(argv[++i]);
    } else if (t === '--min-learner-self-reframe') {
      args.gateThresholds.learner_self_reframe = Number(argv[++i]);
    } else if (t === '--min-dyadic-revision') args.gateThresholds.dyadic_revision = Number(argv[++i]);
    else if (t === '--min-non-leakage') args.gateThresholds.non_leakage = Number(argv[++i]);
    else if (t === '--min-prose-preservation') args.gateThresholds.prose_preservation = Number(argv[++i]);
    else if (t === '--public-max-chars') args.publicMaxChars = Number(argv[++i]);
    else if (t === '--inner-max-chars') args.innerMaxChars = Number(argv[++i]);
    else if (t === '--force') args.force = true;
    else if (t === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown arg: ${t}\n\n${usage()}`);
  }

  args.generator = normalizeBackend(args.generator);
  args.checker = normalizeBackend(args.checker);
  if (args.generator === 'none' || args.generator === 'adversarial') {
    throw new Error('--generator must be mock|codex|claude|agy|gemini');
  }
  if (args.checker === 'adversarial') {
    args.checker = adversarialCheckerFor(args.generator);
    args.checkerPolicy = 'adversarial';
  }
  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) throw new Error('--timeout-ms must be positive');
  if (!Number.isFinite(args.publicMaxChars) || args.publicMaxChars < 500) throw new Error('--public-max-chars too small');
  if (!Number.isFinite(args.innerMaxChars) || args.innerMaxChars < 0) throw new Error('--inner-max-chars must be >= 0');
  validateGateThresholds(args.gateThresholds);
  return args;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeBackend(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const backend = normalized === 'gemini' ? 'agy' : normalized;
  if (!BACKENDS.has(backend)) {
    throw new Error(`backend must be one of ${[...BACKENDS].join('|')} (got ${value})`);
  }
  return backend;
}

export function adversarialCheckerFor(generator) {
  const backend = normalizeBackend(generator);
  if (backend === 'codex') return 'claude';
  if (backend === 'claude') return 'codex';
  if (backend === 'agy') return 'codex';
  if (backend === 'mock') return 'mock';
  throw new Error(`no adversarial checker mapping for generator ${generator}`);
}

function validateGateThresholds(thresholds) {
  for (const key of GATE_SCORE_KEYS) {
    const value = Number(thresholds?.[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`gate threshold ${key} must be a number between 0 and 1`);
    }
  }
}

function resolvedGateThresholds(args = {}) {
  return {
    ...DEFAULT_GATE_THRESHOLDS,
    ...(args.gateThresholds || {}),
  };
}

function normalizeAction(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFindingSeverity(value) {
  return String(value || '').trim().toLowerCase();
}

function scoreValue(check, key) {
  const fallbackKey = key === 'learner_actional_uptake' ? 'learner_uptake_or_contest' : key;
  const raw = Number(check?.scores?.[key] ?? check?.scores?.[fallbackKey]);
  if (!Number.isFinite(raw)) return { raw: null, normalized: null, scale: null };
  if (raw > 10 && raw <= 100) return { raw, normalized: raw / 100, scale: '0-100' };
  if (raw > 5 && raw <= 10) return { raw, normalized: raw / 10, scale: '0-10' };
  if (raw > 1 && raw <= 5) return { raw, normalized: raw / 5, scale: '0-5' };
  return { raw, normalized: raw, scale: '0-1' };
}

function pushScoreGateProblem({ key, normalized, threshold, failures, warnings }) {
  const target = REVISION_ONLY_GATE_SCORE_KEYS.has(key) ? warnings : failures;
  if (normalized === null) {
    target.push({
      criterion: key,
      evidence: 'checker score is missing or non-numeric',
      recommendation: `Revise until ${key} is explicit enough to score before escalation.`,
    });
  } else if (normalized < threshold) {
    target.push({
      criterion: key,
      evidence: `${normalized} < ${threshold}`,
      recommendation: `Revise until ${key} meets the local threshold.`,
    });
  }
}

export function evaluateLocalGate(check, revision = null, args = {}) {
  const enabled = args.localGate !== false;
  const thresholds = resolvedGateThresholds(args);
  validateGateThresholds(thresholds);

  if (!enabled) {
    return {
      enabled,
      status: 'disabled',
      escalate: false,
      thresholds,
      failures: [],
      warnings: [],
      recommended_action: normalizeAction(check?.recommended_action) || null,
      claim_boundary: revision?.claim_boundary || null,
    };
  }

  if (!check) {
    return {
      enabled,
      status: 'unchecked',
      escalate: false,
      thresholds,
      failures: [
        {
          criterion: 'checker',
          evidence: 'No local checker result is present.',
          recommendation: 'Run with --checker claude, --checker agy, --checker codex, or --checker mock before escalating.',
        },
      ],
      warnings: [],
      recommended_action: null,
      claim_boundary: revision?.claim_boundary || null,
    };
  }

  const failures = [];
  const warnings = [];
  const action = normalizeAction(check.recommended_action);

  if (check.passes !== true) {
    failures.push({
      criterion: 'checker_passes',
      evidence: `checker.passes is ${JSON.stringify(check.passes)}`,
      recommendation: 'Revise locally before external scoring.',
    });
  }
  if (check.claim_boundary_ok !== true) {
    failures.push({
      criterion: 'claim_boundary',
      evidence: `checker.claim_boundary_ok is ${JSON.stringify(check.claim_boundary_ok)}`,
      recommendation: 'Repair the counterfactual claim boundary before escalation.',
    });
  }
  if (revision?.claim_boundary && revision.claim_boundary !== 'counterfactual_revision_not_online_adaptation') {
    failures.push({
      criterion: 'revision_claim_boundary',
      evidence: `revision.claim_boundary is ${JSON.stringify(revision.claim_boundary)}`,
      recommendation: 'Keep the artifact labelled as a counterfactual revision, not online tutor adaptation.',
    });
  }
  if (revision?.non_leakage_check?.passes === false) {
    failures.push({
      criterion: 'revision_non_leakage',
      evidence: 'revision.non_leakage_check.passes is false',
      recommendation: 'Remove hidden-only knowledge from the public transcript.',
    });
  }
  if (action === 'discard') {
    failures.push({
      criterion: 'recommended_action',
      evidence: 'checker recommended discard',
      recommendation: 'Do not send this artifact to an expensive critic panel.',
    });
  } else if (action === 'revise_again') {
    warnings.push({
      criterion: 'recommended_action',
      evidence: 'checker recommended revise_again',
      recommendation: 'Keep this in local iteration unless the warning is knowingly overridden.',
    });
  }

  const scoreReport = {};
  for (const key of GATE_SCORE_KEYS) {
    const { raw, normalized, scale } = scoreValue(check, key);
    const threshold = thresholds[key];
    scoreReport[key] = {
      raw,
      value: normalized,
      scale,
      threshold,
      passes: normalized !== null && normalized >= threshold,
    };
    if (normalized === null) {
      pushScoreGateProblem({ key, normalized, threshold, failures, warnings });
    } else if (normalized < threshold) {
      pushScoreGateProblem({ key, normalized, threshold, failures, warnings });
    }
  }

  const findings = Array.isArray(check.findings) ? check.findings : [];
  for (const finding of findings) {
    const severity = normalizeFindingSeverity(finding?.severity);
    if (severity === 'fail') {
      failures.push({
        criterion: finding.criterion || 'checker_finding',
        evidence: finding.evidence || 'checker reported a fail finding',
        recommendation: finding.recommendation || 'Revise locally before escalation.',
      });
    } else if (severity === 'warning') {
      warnings.push({
        criterion: finding.criterion || 'checker_finding',
        evidence: finding.evidence || 'checker reported a warning',
        recommendation: finding.recommendation || 'Review before escalation.',
      });
    }
  }

  const status = failures.length ? 'reject' : warnings.length ? 'revise_again' : 'survivor';
  return {
    enabled,
    status,
    escalate: status === 'survivor',
    thresholds,
    scores: scoreReport,
    failures,
    warnings,
    recommended_action: action || null,
    claim_boundary: revision?.claim_boundary || null,
  };
}

function summarizeRecordForList(record) {
  return {
    item_id: record.item?.id || record.item,
    run_id: record.item?.run_id || null,
    status: record.gate?.status || (record.dryRun ? 'dry_run' : 'unknown'),
    revised_public_path: record.paths?.revisedPublic || null,
    revision_json_path: record.paths?.revisionJson || null,
    check_json_path: record.paths?.checkJson || null,
    manifest_path: record.paths?.manifest || null,
    failures: record.gate?.failures || [],
    warnings: record.gate?.warnings || [],
  };
}

export function summarizeGate(records = []) {
  const counts = {};
  const byStatus = {
    survivors: [],
    needs_revision: [],
    rejected: [],
    unchecked: [],
    disabled: [],
    dry_run: [],
    unknown: [],
  };

  for (const record of records) {
    const status = record.gate?.status || (record.dryRun ? 'dry_run' : 'unknown');
    counts[status] = (counts[status] || 0) + 1;
    const summary = summarizeRecordForList(record);
    if (status === 'survivor') byStatus.survivors.push(summary);
    else if (status === 'revise_again') byStatus.needs_revision.push(summary);
    else if (status === 'reject') byStatus.rejected.push(summary);
    else if (status === 'unchecked') byStatus.unchecked.push(summary);
    else if (status === 'disabled') byStatus.disabled.push(summary);
    else if (status === 'dry_run') byStatus.dry_run.push(summary);
    else byStatus.unknown.push(summary);
  }

  return {
    counts,
    ...byStatus,
  };
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function sha256Short(text) {
  return createHash('sha256').update(String(text ?? '')).digest('hex').slice(0, 16);
}

function safeSlug(value) {
  return String(value || 'item')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function resolveMaybeRepoPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

function truncateMiddle(text, maxChars) {
  const value = String(text || '');
  if (!Number.isFinite(maxChars) || maxChars <= 0) return '';
  if (value.length <= maxChars) return value;
  const head = Math.floor(maxChars * 0.62);
  const tail = Math.max(500, maxChars - head - 120);
  return `${value.slice(0, head)}\n\n[...truncated ${value.length - head - tail} chars...]\n\n${value.slice(-tail)}`;
}

function readText(filePath) {
  if (!filePath) return '';
  if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

export function extractPublicTranscript(fullText) {
  const text = String(fullText || '');
  const publicSection = text.match(/## Public Performance\s*\n+```(?:text)?\s*\n([\s\S]*?)\n```/i);
  if (publicSection) return publicSection[1].trim();
  const publicLoose = text.match(/## Public Performance\s*\n+([\s\S]*?)(?:\n## |\n# |\z)/i);
  if (publicLoose) return publicLoose[1].trim();
  return text.trim();
}

function extractHeldOutContext(fullText, publicTranscript) {
  const text = String(fullText || '');
  if (!publicTranscript) return text;
  return text.replace(publicTranscript, '[PUBLIC PERFORMANCE EXTRACTED SEPARATELY]').trim();
}

function parseKeyYaml(keyText) {
  if (!keyText.trim()) return null;
  try {
    return yaml.parse(keyText);
  } catch {
    return { parse_status: 'error', raw: keyText.slice(0, 2000) };
  }
}

export function parseJsonResponse(content) {
  const raw = String(content || '').trim();
  const candidates = [];
  candidates.push(raw);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstObj = raw.indexOf('{');
  const lastObj = raw.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(raw.slice(firstObj, lastObj + 1));

  const errors = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch (error) {
      errors.push(error.message);
    }
    try {
      return JSON.parse(jsonrepair(candidate));
    } catch (error) {
      errors.push(`repair: ${error.message}`);
    }
  }
  throw new Error(`failed to parse JSON response: ${errors.join(' | ')}\n${raw.slice(0, 500)}`);
}

function defaultOutDir() {
  return path.join(ROOT_DIR, 'exports', 'discursive-replays', `discursive-replay-${timestampId()}`);
}

function loadItems(args) {
  if (args.transcript) {
    return [
      {
        id: safeSlug(path.basename(args.transcript).replace(/\.[^.]+$/, '')),
        run_id: null,
        full_transcript_path: args.transcript,
        key_path: args.key,
        source: 'direct_path',
      },
    ];
  }

  if (!args.itemIds.length && !args.runId) {
    throw new Error(`provide --item-id, --run-id, or --transcript\n\n${usage()}`);
  }
  if (!fs.existsSync(args.db)) throw new Error(`DB not found: ${args.db}`);
  const db = new Database(args.db, { readonly: true });
  try {
    if (args.itemIds.length) {
      const stmt = db.prepare(
        `SELECT id, run_id, full_transcript_path, key_path,
                intended_lean, control_family, control_role, quality_status, quality_warnings
         FROM poetics_items
         WHERE id = ?`,
      );
      return args.itemIds.map((id) => {
        const row = stmt.get(id);
        if (!row) throw new Error(`poetics item not found: ${id}`);
        return { ...row, source: 'poetics_items' };
      });
    }
    const rows = db
      .prepare(
        `SELECT id, run_id, full_transcript_path, key_path,
                intended_lean, control_family, control_role, quality_status, quality_warnings
         FROM poetics_items
         WHERE run_id = ? AND full_transcript_path IS NOT NULL
         ORDER BY id
         LIMIT ?`,
      )
      .all(args.runId, args.limit);
    if (!rows.length) throw new Error(`no poetics_items rows with transcripts for run_id=${args.runId}`);
    return rows.map((row) => ({ ...row, source: 'poetics_items' }));
  } finally {
    db.close();
  }
}

function buildOntologySummary() {
  return `Discursive-game/accountable-scorekeeping criteria:
- Treat this as counterfactual offline revision, not online adaptation.
- Preserve the dramatic setting, roles, task facts, and learner voice unless needed for accountability.
- Make learner signal -> tutor hypothesis -> selected tactic -> public tutor move -> learner uptake/contest -> later tutor revision inspectable.
- Do not let learner action alone count as recognition. The final learner move must own a self-reframe in ordinary domain language: name the old warrant/check, name why it no longer settles the case, name the new warrant/check, and apply it.
- Every tutor shift must be licensed by public evidence or by held-out state that is also publicly licensable; do not leak hidden-only facts as tutor knowledge.
- Repair without learner uptake is repair, not adaptation credit.
- Prefer finite tactics: request_elaboration, invite_objection, name_the_disagreement, scope_test, pose_counterexample, withhold_answer, repair_misrecognition, summarize_and_check, mirror_and_extend.
- Output JSON only.`;
}

export function buildRewritePrompt({ item, publicTranscript, heldOutContext, keyText, keyData }) {
  const systemPrompt = `You are a counterfactual transcript reviser for a research harness.

You revise one existing public transcript copy to make accountable discursive adaptation more inspectable. You may use held-out inner state for diagnosis, but the revised public transcript must not reveal hidden-only facts unless the public transcript licenses them.

${buildOntologySummary()}`;

  const userPrompt = `Revise the transcript below in one pass.

Required JSON shape:
{
  "revised_public_transcript": "STAGE/TUTOR/LEARNER text only",
  "move_ledger": [
    {
      "turn": "short locator",
      "learner_signal": "what pressure/uptake/contest is visible",
      "evidence_quote": "public quote licensing the diagnosis",
      "tutor_hypothesis": "evidence-bound hypothesis, not hidden omniscience",
      "tactic": "finite tactic name",
      "public_action": "what the tutor publicly does",
      "learner_actional_uptake": "visible learner performance or contest",
      "learner_self_reframe": {
        "old_warrant": "what the learner was checking by before",
        "warrant_limit": "why that check no longer settles the case",
        "new_warrant": "what now counts as public evidence",
        "application": "how the learner applies the new warrant to the task object"
      },
      "tutor_revision": "later tutor revision accountable to uptake/contest",
      "ontology_terms": ["ResponsiveMove", "AccountableRepair", "DyadicRevision"]
    }
  ],
  "hidden_state_use_ledger": [
    {
      "private_fact": "private fact or inner-state cue used",
      "used_for": "diagnosis|tactic_selection|continuity_check|not_used",
      "public_license_quote": "public transcript evidence that licenses public use, or null",
      "leakage_risk": "none|low|medium|high"
    }
  ],
  "non_leakage_check": {"passes": true, "notes": ["..."]},
  "claim_boundary": "counterfactual_revision_not_online_adaptation"
}

Source item:
${JSON.stringify(
  {
    id: item.id,
    run_id: item.run_id,
    tutor_adaptation_policy: item.tutor_adaptation_policy || null,
    intended_lean: item.intended_lean,
    control_family: item.control_family,
    control_role: item.control_role,
    quality_status: item.quality_status,
  },
  null,
  2,
)}

Held-out key metadata, if any:
${keyText ? keyText : '[none]'}

Parsed key excerpt:
${keyData ? JSON.stringify(keyData, null, 2).slice(0, 6000) : '[none]'}

Original public transcript:
${publicTranscript}

Held-out inner state / full transcript context:
${heldOutContext || '[none]'}`;

  return { systemPrompt, userPrompt };
}

export function buildCheckPrompt({ item, publicTranscript, revision }) {
  const systemPrompt = `You are an arm's-length smoke-check critic for counterfactual transcript revision.

Do not score general writing quality as the main target. Check whether the revised transcript makes accountable discursive adaptation inspectable while preserving non-leakage and claim boundaries.

Return JSON only.`;

  const userPrompt = `Check this counterfactual revision.

Required JSON shape:
{
  "passes": true,
  "claim_boundary_ok": true,
  "scores": {
    "public_evidence": 0,
    "tactic_selection": 0,
    "learner_actional_uptake": 0,
    "learner_self_reframe": 0,
    "dyadic_revision": 0,
    "non_leakage": 0,
    "prose_preservation": 0
  },
  "findings": [
    {"severity": "info|warning|fail", "criterion": "...", "evidence": "...", "recommendation": "..."}
  ],
  "recommended_action": "accept_for_blind_panel|revise_again|discard"
}

Criteria:
${buildOntologySummary()}

Scoring guidance:
- Score each criterion on 0.0-1.0 when possible. If you use whole-number scoring, use 0-10; percentages are accepted but not preferred.
- learner_actional_uptake: learner performs or contests the new public test.
- learner_self_reframe: learner explicitly contrasts old check, limit/failure, new check, and application in domain language.
- If actional uptake is high but learner_self_reframe is missing or implicit, recommend revise_again rather than accept_for_blind_panel.
- Set passes=false only for discard-level problems such as leakage, broken claim boundary, unusable JSON/prose, or a fundamentally incoherent revision.

Item: ${JSON.stringify({ id: item.id, run_id: item.run_id }, null, 2)}

Original public transcript:
${publicTranscript}

Revision JSON:
${JSON.stringify(revision, null, 2)}`;

  return { systemPrompt, userPrompt };
}

function mockRevision({ publicTranscript }) {
  return {
    revised_public_transcript: `${publicTranscript.trim()}\n\n[COUNTERFACTUAL ACCOUNTABILITY PASS: tutor move ledger requires public evidence before any revision claim.]`,
    move_ledger: [
      {
        turn: 'mock-turn',
        learner_signal: 'visible learner pressure or uptake',
        evidence_quote: 'mock public quote',
        tutor_hypothesis: 'evidence-bound hypothesis',
        tactic: 'scope_test',
        public_action: 'tutor asks for a public test of the learner claim',
        learner_actional_uptake: 'learner performs or contests the test',
        learner_self_reframe: {
          old_warrant: 'learner had been using the old visible arrangement as the check',
          warrant_limit: 'the old arrangement no longer settles the unresolved pressure',
          new_warrant: 'the new public test states what now counts as evidence',
          application: 'learner applies the new check to the task object',
        },
        tutor_revision: 'tutor revises next move in response to uptake',
        ontology_terms: ['ResponsiveMove', 'AccountableScorekeepingEpisode', 'DyadicRevision'],
      },
    ],
    hidden_state_use_ledger: [
      {
        private_fact: 'mock held-out state cue',
        used_for: 'continuity_check',
        public_license_quote: null,
        leakage_risk: 'none',
      },
    ],
    non_leakage_check: { passes: true, notes: ['mock path does not use hidden content'] },
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
  };
}

function mockCheck() {
  return {
    passes: true,
    claim_boundary_ok: true,
    scores: {
      public_evidence: 0.8,
      tactic_selection: 0.8,
      learner_actional_uptake: 0.8,
      learner_self_reframe: 0.8,
      dyadic_revision: 0.75,
      non_leakage: 1,
      prose_preservation: 0.7,
    },
    findings: [
      {
        severity: 'info',
        criterion: 'mock',
        evidence: 'deterministic mock check',
        recommendation: 'use real CLI checker for substantive screening',
      },
    ],
    recommended_action: 'accept_for_blind_panel',
  };
}

async function callBackend(backend, prompts, options, role) {
  if (backend === 'mock') {
    return {
      content: JSON.stringify(role === 'checker' ? mockCheck() : mockRevision({ publicTranscript: options.publicTranscript }), null, 2),
      provenance: {
        backend: 'mock',
        role,
        latencyMs: 0,
        model: 'mock',
        promptHashes: {
          system: sha256Short(prompts.systemPrompt),
          user: sha256Short(prompts.userPrompt),
        },
      },
    };
  }
  if (backend === 'codex') return callCodex(prompts, options, role);
  if (backend === 'claude') return callClaude(prompts, options, role);
  if (backend === 'agy') return callAgy(prompts, options, role);
  throw new Error(`unsupported backend for call: ${backend}`);
}

function callCodex({ systemPrompt, userPrompt }, options, role) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-codex-'));
    const outFile = path.join(tmpDir, 'out.txt');
    const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '--ignore-user-config',
      '-s',
      'read-only',
      '-C',
      tmpDir,
      '--color',
      'never',
    ];
    if (options.codexModel) args.push('-m', options.codexModel);
    if (options.codexEffort) args.push('-c', `model_reasoning_effort="${options.codexEffort}"`);
    args.push('-o', outFile, '-');

    const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      cleanup();
      reject(new Error(`codex timed out after ${options.timeoutMs}ms (${role})`));
    }, options.timeoutMs);
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let content = '';
      try {
        content = fs.readFileSync(outFile, 'utf8');
      } catch {
        // missing output handled below
      }
      cleanup();
      if (code !== 0 && !content.trim()) {
        reject(new Error(err.trim() || `codex exited ${code} (${role})`));
      } else {
        resolve({
          content: content.trim(),
          provenance: {
            backend: 'codex',
            cli: 'codex exec',
            role,
            model: options.codexModel || 'config-default',
            reasoningEffort: options.codexEffort || null,
            latencyMs: Date.now() - start,
            promptHashes: {
              system: sha256Short(systemPrompt),
              user: sha256Short(userPrompt),
            },
            args,
          },
        });
      }
    });
    child.stdin.write(`${systemPrompt}\n\n---\n\n${userPrompt}`);
    child.stdin.end();
  });
}

function callClaude({ systemPrompt, userPrompt }, options, role) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-claude-'));
    const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
    const args = [
      '--no-session-persistence',
      '--disable-slash-commands',
      '--no-chrome',
      '--setting-sources',
      'user',
      '--tools',
      '',
      '-p',
      '-',
      '--output-format',
      'text',
      '--system-prompt',
      systemPrompt,
    ];
    if (options.claudeModel) args.push('--model', options.claudeModel);
    if (options.claudeEffort) args.push('--effort', options.claudeEffort);
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir, env });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      cleanup();
      reject(new Error(`claude timed out after ${options.timeoutMs}ms (${role})`));
    }, options.timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `claude exited ${code} (${role})`));
      } else {
        resolve({
          content: out.trim(),
          provenance: {
            backend: 'claude',
            cli: 'claude',
            role,
            model: options.claudeModel || 'default',
            reasoningEffort: options.claudeEffort || null,
            latencyMs: Date.now() - start,
            promptHashes: {
              system: sha256Short(systemPrompt),
              user: sha256Short(userPrompt),
            },
            args: [
              '-p',
              '-',
              '--output-format',
              'text',
              '--system-prompt',
              `<sha256:${sha256Short(systemPrompt)}>`,
              ...(options.claudeModel ? ['--model', options.claudeModel] : []),
              ...(options.claudeEffort ? ['--effort', options.claudeEffort] : []),
            ],
          },
        });
      }
    });
    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

function callAgy({ systemPrompt, userPrompt }, options, role) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-agy-'));
    const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });
    const timeoutMs = Math.max(options.timeoutMs, DEFAULT_AGY_TIMEOUT_MS);
    const args = ['--print', '--print-timeout', '10m', '--dangerously-skip-permissions'];
    const child = spawn(options.agyBin, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir, env: { ...process.env } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      cleanup();
      reject(new Error(`agy timed out after ${timeoutMs}ms (${role}, outBytes=${out.length})`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `agy exited ${code} (${role})`));
      } else {
        resolve({
          content: out.trim(),
          provenance: {
            backend: 'agy',
            cli: 'agy',
            role,
            model: options.agyModelLabel,
            reasoningEffort: null,
            latencyMs: Date.now() - start,
            promptHashes: {
              system: sha256Short(systemPrompt),
              user: sha256Short(userPrompt),
            },
            args,
          },
        });
      }
    });
    child.stdin.write(`${systemPrompt}\n\n---\n\n${userPrompt}`);
    child.stdin.end();
  });
}

function validateRevisionPayload(payload) {
  const required = ['revised_public_transcript', 'move_ledger', 'hidden_state_use_ledger', 'non_leakage_check'];
  for (const key of required) {
    if (!(key in payload)) throw new Error(`revision JSON missing ${key}`);
  }
  if (!Array.isArray(payload.move_ledger)) throw new Error('revision.move_ledger must be an array');
  if (!Array.isArray(payload.hidden_state_use_ledger)) throw new Error('revision.hidden_state_use_ledger must be an array');
  return payload;
}

async function replayOne(item, args, outDir) {
  const fullTranscriptPath = resolveMaybeRepoPath(item.full_transcript_path);
  const keyPath = resolveMaybeRepoPath(item.key_path || args.key);
  const fullText = readText(fullTranscriptPath);
  const rawPublic = extractPublicTranscript(fullText);
  const publicTranscript = truncateMiddle(rawPublic, args.publicMaxChars);
  const heldOutContext = truncateMiddle(extractHeldOutContext(fullText, rawPublic), args.innerMaxChars);
  const keyText = keyPath && fs.existsSync(keyPath) ? truncateMiddle(readText(keyPath), args.innerMaxChars) : '';
  const keyData = parseKeyYaml(keyText);
  const itemSlug = safeSlug(item.id || path.basename(fullTranscriptPath));
  const itemDir = path.join(outDir, itemSlug);
  const itemManifestPath = path.join(itemDir, 'manifest.json');
  const gatePath = path.join(itemDir, 'gate.json');
  if (fs.existsSync(itemDir) && !args.force) {
    throw new Error(`output exists: ${itemDir} (pass --force to overwrite)`);
  }
  fs.mkdirSync(itemDir, { recursive: true });

  const rewritePrompt = buildRewritePrompt({ item, publicTranscript, heldOutContext, keyText, keyData });
  fs.writeFileSync(path.join(itemDir, 'original-public.txt'), rawPublic);
  fs.writeFileSync(path.join(itemDir, 'rewrite.prompt.txt'), `${rewritePrompt.systemPrompt}\n\n---\n\n${rewritePrompt.userPrompt}`);

  if (args.dryRun) {
    return {
      item: item.id,
      itemDir,
      dryRun: true,
      generator: args.generator,
      checker: args.checker,
      checkerPolicy: args.checkerPolicy || null,
      localGate: args.localGate !== false,
      originalTranscriptPath: fullTranscriptPath,
      keyPath,
    };
  }

  const generatorCall = await callBackend(args.generator, rewritePrompt, { ...args, publicTranscript }, 'generator');
  fs.writeFileSync(path.join(itemDir, 'rewrite.raw.txt'), generatorCall.content);
  const revision = validateRevisionPayload(parseJsonResponse(generatorCall.content));
  fs.writeFileSync(path.join(itemDir, 'revision.json'), JSON.stringify(revision, null, 2));
  fs.writeFileSync(path.join(itemDir, 'revised-public.txt'), revision.revised_public_transcript || '');

  let checker = null;
  if (args.checker !== 'none') {
    const checkPrompt = buildCheckPrompt({ item, publicTranscript, revision });
    fs.writeFileSync(path.join(itemDir, 'check.prompt.txt'), `${checkPrompt.systemPrompt}\n\n---\n\n${checkPrompt.userPrompt}`);
    const checkerCall = await callBackend(args.checker, checkPrompt, { ...args, publicTranscript }, 'checker');
    fs.writeFileSync(path.join(itemDir, 'check.raw.txt'), checkerCall.content);
    checker = {
      parsed: parseJsonResponse(checkerCall.content),
      provenance: checkerCall.provenance,
    };
    fs.writeFileSync(path.join(itemDir, 'check.json'), JSON.stringify(checker, null, 2));
  }

  const gate = evaluateLocalGate(checker?.parsed || null, revision, args);
  fs.writeFileSync(gatePath, JSON.stringify(gate, null, 2));

  const record = {
    item: {
      id: item.id,
      run_id: item.run_id,
      source: item.source,
      full_transcript_path: item.full_transcript_path,
      key_path: item.key_path || args.key || null,
    },
    paths: {
      itemDir,
      originalPublic: path.join(itemDir, 'original-public.txt'),
      revisedPublic: path.join(itemDir, 'revised-public.txt'),
      revisionJson: path.join(itemDir, 'revision.json'),
      checkJson: checker ? path.join(itemDir, 'check.json') : null,
      gateJson: gatePath,
      manifest: itemManifestPath,
    },
    generator: generatorCall.provenance,
    checker: checker?.provenance || null,
    checkerPolicy: args.checkerPolicy || null,
    check: checker?.parsed || null,
    gate,
  };
  fs.writeFileSync(itemManifestPath, JSON.stringify(record, null, 2));
  return record;
}

function writeGateSummaryFiles(outDir, summary) {
  const writeJson = (fileName, data) => {
    fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(data, null, 2));
  };
  writeJson('survivors.json', summary.survivors);
  writeJson('needs-revision.json', summary.needs_revision);
  writeJson('rejected.json', summary.rejected);
  writeJson('unchecked.json', summary.unchecked);
  writeJson('disabled-gate.json', summary.disabled);

  const survivorPaths = summary.survivors
    .map((entry) => entry.revised_public_path)
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(path.join(outDir, 'survivors.txt'), survivorPaths ? `${survivorPaths}\n` : '');
}

export async function runReplay(rawArgs) {
  const args = typeof rawArgs?.generator === 'string' ? rawArgs : parseArgs(rawArgs);
  if (args.help) return { help: usage() };
  const outDir = args.outDir || defaultOutDir();
  fs.mkdirSync(outDir, { recursive: true });
  const items = loadItems(args);
  const records = [];
  for (const item of items) {
    records.push(await replayOne(item, args, outDir));
  }
  const gateSummary = summarizeGate(records);
  writeGateSummaryFiles(outDir, gateSummary);
  const manifest = {
    kind: 'discursive_replay_bundle',
    created_at: new Date().toISOString(),
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
    generator: args.generator,
    checker: args.checker,
    checker_policy: args.checkerPolicy || null,
    local_gate: {
      enabled: args.localGate !== false,
      thresholds: resolvedGateThresholds(args),
      summary: gateSummary,
      next_stage_rule: 'Only gate.status=survivor artifacts should move to OpenRouter or human panels without another local pass.',
    },
    count: records.length,
    records,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { outDir, manifest };
}

async function main() {
  try {
    const args = parseArgs();
    if (args.help) {
      console.log(usage());
      return;
    }
    const result = await runReplay(args);
    console.log(
      JSON.stringify(
        {
          outDir: result.outDir,
          count: result.manifest.count,
          gate: result.manifest.local_gate?.summary?.counts || {},
          survivors: result.manifest.local_gate?.summary?.survivors?.length || 0,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
