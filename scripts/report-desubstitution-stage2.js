// Stage 2 / confirmatory de-substitution matrix scorer (plan note §7,
// confirmatory pre-registration notes/2026-07-04-desubstitution-confirmatory-
// prereg.md). Reads a run's rows, locates each dialogue log, and extracts the
// judge-free outcomes written by the learner-interior gate:
//   grounded   — any learner_grounding trace entry with grounded:true (primary)
//   release    — any learner_content_condition entry with met:true
//   engagement — any accepted learner_drift_gate entry with contentConditionMet:true
//   attempts   — drift-gate attempt counts; instrument_failure rows excluded
// Applies the frozen H-D/H-O (or H-Dc/H-Oc) rules with the grounding-floor and
// >20% exhaustion guards. No judge anywhere in the decision path — semantic
// release verdicts are read from the already-cached trace, never re-called.
//
// Usage: node scripts/report-desubstitution-stage2.js [--run-id <id>]
//          [--out-base <name>] [--confirmatory]
//
// Default (no --confirmatory): iteration-2 thresholds (n=20/arm) — H-D/H-O
// real >=5, dissolved |gap|<=2, else UNRESOLVED_STOP. H-O is scored with the
// same one-sided function as H-D (as iteration 2 recorded it).
//
// --confirmatory: the frozen C-series thresholds (n=40/arm, notes/2026-07-04-
// desubstitution-confirmatory-prereg.md §1-2) — H-Dc is one-sided (193 > 186
// is the declared expectation): gap >=7 REAL, <=3 DISSOLVED, else
// UNRESOLVED-FINAL (arc closes permanently). H-Oc is symmetric (either arm
// may lead): |gap| >=7 REAL, <=3 DISSOLVED, else UNRESOLVED-FINAL, with a
// reported direction (kernel-favoring / 193-favoring).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RUN_ID = process.argv.includes('--run-id')
  ? process.argv[process.argv.indexOf('--run-id') + 1]
  : 'eval-2026-07-03-a3cfbe14';
const OUT_BASE = process.argv.includes('--out-base')
  ? process.argv[process.argv.indexOf('--out-base') + 1]
  : 'desubstitution-stage2-matrix';
const CONFIRMATORY = process.argv.includes('--confirmatory');
const DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT, 'data/evaluations.db');
const LOG_DIRS = [
  process.env.EVAL_LOGS_DIR ? path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues') : null,
  path.join(os.homedir(), '.machinespirits-data/logs/tutor-dialogues'),
  path.join(ROOT, 'logs/tutor-dialogues'),
].filter(Boolean);

const ARMS = [
  { key: '186_fixed', match: 'cell_186' },
  { key: '193_multi', match: 'cell_193' },
  { key: '199_kernel', match: 'cell_199' },
];
const SUBTYPES = ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting'];

function armOf(profile) {
  const arm = ARMS.find((a) => profile.startsWith(a.match));
  return arm ? arm.key : 'other';
}
function subtypeOf(scenarioId) {
  return SUBTYPES.find((s) => scenarioId.endsWith(s)) || 'other';
}
function loadLog(dialogueId) {
  for (const dir of LOG_DIRS) {
    const p = path.join(dir, `${dialogueId}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return null;
}
function parseDetail(detail) {
  if (detail && typeof detail === 'object') return detail;
  try {
    return JSON.parse(detail);
  } catch {
    return null;
  }
}

function scoreRow(log) {
  const trace = log?.dialogueTrace || [];
  const out = {
    grounded: false,
    release: false,
    engagement: false,
    instrumentFailure: false,
    attempts: [],
    gateEntries: 0,
  };
  for (const entry of trace) {
    const detail = parseDetail(entry.detail);
    if (entry.agent === 'learner_grounding' && detail?.grounded === true) out.grounded = true;
    if (entry.agent === 'learner_content_condition' && detail?.met === true) {
      out.release = true;
      if (String(detail.evidence || '').startsWith('[semantic]')) out.semanticRelease = true;
    }
    if (entry.agent === 'learner_drift_gate' && detail) {
      out.gateEntries += 1;
      out.attempts.push(Array.isArray(detail.attempts) ? detail.attempts.length : 1);
      if (detail.instrument_failure === true) out.instrumentFailure = true;
      if (detail.accepted === true && detail.contentConditionMet === true) out.engagement = true;
    }
  }
  return out;
}

const db = new Database(DB_PATH, { readonly: true });
const rows = db
  .prepare(
    `SELECT dialogue_id, profile_name, scenario_id FROM evaluation_results
     WHERE run_id = ? AND success = 1`,
  )
  .all(RUN_ID);
db.close();

const scored = [];
let missingLogs = 0;
for (const row of rows) {
  const log = loadLog(row.dialogue_id);
  if (!log) {
    missingLogs += 1;
    continue;
  }
  scored.push({
    arm: armOf(row.profile_name),
    subtype: subtypeOf(row.scenario_id),
    dialogueId: row.dialogue_id,
    ...scoreRow(log),
  });
}

function agg(filter) {
  const set = scored.filter(filter);
  const usable = set.filter((r) => !r.instrumentFailure);
  const n = usable.length;
  const sum = (f) => usable.filter(f).length;
  const attempts = usable.flatMap((r) => r.attempts);
  return {
    rows: set.length,
    usable: n,
    instrument_failures: set.length - n,
    grounded: sum((r) => r.grounded),
    release: sum((r) => r.release),
    semantic_release: sum((r) => r.semanticRelease),
    engagement: sum((r) => r.engagement),
    mean_gate_attempts: attempts.length
      ? Number((attempts.reduce((a, b) => a + b, 0) / attempts.length).toFixed(2))
      : null,
  };
}

const perArm = {};
const perCell = {};
const exhaustionFreeze = [];
for (const arm of ARMS.map((a) => a.key)) {
  perArm[arm] = agg((r) => r.arm === arm);
  for (const sub of SUBTYPES) {
    const cell = agg((r) => r.arm === arm && r.subtype === sub);
    perCell[`${arm}|${sub}`] = cell;
    if (cell.rows > 0 && cell.instrument_failures / cell.rows > 0.2) {
      exhaustionFreeze.push(`${arm}|${sub}`);
    }
  }
}

const groundingFloor = ARMS.every((a) => perArm[a.key].grounded === 0);
const primary = (arm) => perArm[arm].grounded;
const gapHD = primary('193_multi') - primary('186_fixed');
const gapHO = primary('199_kernel') - primary('193_multi');

// One-sided verdict for H-D/H-Dc: 193 > 186 is the declared expectation, so a
// negative or small gap is evidence against the hypothesis, not a separate
// "other direction real" case. Iteration-2 thresholds (n=20/arm, legacy
// default): real >=5, dissolved |gap|<=2, else UNRESOLVED_STOP. Confirmatory
// thresholds (n=40/arm, notes/2026-07-04-desubstitution-confirmatory-
// prereg.md §1): real >=7, dissolved <=3, else UNRESOLVED-FINAL (arc closes
// permanently — no third bite).
function verdictOneSided(gap) {
  if (CONFIRMATORY) {
    if (gap >= 7) return 'REAL';
    if (gap <= 3) return 'DISSOLVED';
    return 'UNRESOLVED-FINAL';
  }
  if (gap >= 5) return 'REAL';
  if (Math.abs(gap) <= 2) return 'DISSOLVED';
  return 'UNRESOLVED_STOP';
}

// Symmetric verdict for H-Oc only (prereg §3.2 [sic §2]: "kernel-favoring or
// 193-favoring" — two-sided, unlike H-Dc's one-sided expectation). Legacy
// (non-confirmatory) H-O scoring is unchanged: it delegates to the same
// one-sided function iteration 2 used, preserving prior behavior exactly.
function verdictSymmetric(gap) {
  const direction = gap > 0 ? 'kernel-favoring' : gap < 0 ? '193-favoring' : 'flat';
  if (!CONFIRMATORY) return { verdict: verdictOneSided(gap), direction };
  const abs = Math.abs(gap);
  if (abs >= 7) return { verdict: 'REAL', direction };
  if (abs <= 3) return { verdict: 'DISSOLVED', direction };
  return { verdict: 'UNRESOLVED-FINAL', direction };
}

const frozenArms = new Set(exhaustionFreeze.map((c) => c.split('|')[0]));
const comparisonFrozen = (a, b) => frozenArms.has(a) || frozenArms.has(b);
const hoScored = verdictSymmetric(gapHO);
const result = {
  runId: RUN_ID,
  confirmatory: CONFIRMATORY,
  rowsScored: scored.length,
  missingLogs,
  perArm,
  perCell,
  guards: {
    grounding_floor_all_arms_zero: groundingFloor,
    exhaustion_freeze_cells: exhaustionFreeze,
  },
  hd: comparisonFrozen('193_multi', '186_fixed')
    ? { verdict: 'FROZEN_INSTRUMENT_FAILURE', gap: gapHD }
    : groundingFloor
      ? { verdict: 'INSTRUMENT_FLOOR_UNRESOLVED', gap: gapHD }
      : { verdict: verdictOneSided(gapHD), gap: gapHD },
  ho: comparisonFrozen('199_kernel', '193_multi')
    ? { verdict: 'FROZEN_INSTRUMENT_FAILURE', gap: gapHO, direction: hoScored.direction }
    : groundingFloor
      ? { verdict: 'INSTRUMENT_FLOOR_UNRESOLVED', gap: gapHO, direction: hoScored.direction }
      : { verdict: hoScored.verdict, gap: gapHO, direction: hoScored.direction },
  legacy_control_line:
    'Legacy §6.14 control (non-pinned learner, same arms/subtypes, n=6/cell): positives 193-arm 30/30 vs 199-arm 24/30; 186-floor not directly comparable (different outcome).',
};
if (CONFIRMATORY) {
  result.iteration2_comparison_line =
    'Iteration 2 generating observation (`eval-2026-07-04-c689cf3a`, n=20/arm, never pooled into this confirmatory estimate): grounded 186_fixed=0/20, 193_multi=4/20, 199_kernel=2/20 (H-D gap 4 → UNRESOLVED_STOP; H-O FROZEN on kernel exhaustion in boredom + rote_parroting).';
}

fs.mkdirSync(path.join(ROOT, 'exports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `exports/${OUT_BASE}.json`), JSON.stringify(result, null, 2));

const hdLabel = CONFIRMATORY ? 'H-Dc' : 'H-D';
const hoLabel = CONFIRMATORY ? 'H-Oc' : 'H-O';
const fmtAttempts = (v) => (v === null || v === undefined ? 'n/a' : v);
const lines = [
  CONFIRMATORY
    ? '# De-Substitution Confirmatory Matrix (C2) — DAG-Pinned Learner'
    : '# De-Substitution Stage 2 Matrix — DAG-Pinned Learner',
  '',
  `Run \`${RUN_ID}\` · ${scored.length} rows scored (${missingLogs} missing logs) · outcomes judge-free (gate traces only)`,
  '',
  '| Arm | Usable | Grounded | Release (semantic) | Engagement | Mean gate attempts | Instrument failures |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...ARMS.map((a) => {
    const s = perArm[a.key];
    return `| ${a.key} | ${s.usable} | ${s.grounded} | ${s.release} (${s.semantic_release}) | ${s.engagement} | ${fmtAttempts(s.mean_gate_attempts)} | ${s.instrument_failures} |`;
  }),
  '',
  '## Per arm × subtype (usable rows; instrument-failure rows excluded)',
  '',
  '| Subtype | Arm | Usable | Grounded | Release (semantic) | Engagement | Mean gate attempts | Instrument failures |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...SUBTYPES.flatMap((sub) =>
    ARMS.map((a) => {
      const c = perCell[`${a.key}|${sub}`];
      return `| ${sub} | ${a.key} | ${c.usable} | ${c.grounded} | ${c.release} (${c.semantic_release}) | ${c.engagement} | ${fmtAttempts(c.mean_gate_attempts)} | ${c.instrument_failures} |`;
    }),
  ),
  '',
  `Guards: grounding floor (all arms zero) = **${groundingFloor}**; exhaustion-freeze cells: ${
    exhaustionFreeze.length ? exhaustionFreeze.join(', ') : 'none'
  }.`,
  '',
  `**${hdLabel} (193 vs 186)**: gap ${gapHD} → **${result.hd.verdict}**`,
  `**${hoLabel} (199 vs 193)**: gap ${gapHO} → **${result.ho.verdict}**${
    result.ho.direction && result.ho.direction !== 'flat' ? ` (${result.ho.direction})` : ''
  }`,
  '',
  result.legacy_control_line,
  ...(result.iteration2_comparison_line ? ['', result.iteration2_comparison_line] : []),
  '',
];
fs.writeFileSync(path.join(ROOT, `exports/${OUT_BASE}.md`), lines.join('\n'));
console.log(lines.join('\n'));
