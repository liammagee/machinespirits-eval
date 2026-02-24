#!/usr/bin/env node

/**
 * Analyze recognition effect definitions side-by-side.
 *
 * Definitions reported:
 *   1) no-memory  = recog_nomem vs base_nomem
 *   2) with-memory = recog_mem vs base_mem
 *   3) pooled-main = (recog_nomem + recog_mem) vs (base_nomem + base_mem)
 *
 * Defaults are set to the paper's corrected 2x2 memory-isolation runs.
 *
 * Usage:
 *   node scripts/analyze-recognition-definitions.js
 *   node scripts/analyze-recognition-definitions.js --balanced-per-cell 30
 *   node scripts/analyze-recognition-definitions.js --run-ids eval-2026-02-06-81f2d5a1,eval-2026-02-06-ac9ea8f5
 *   node scripts/analyze-recognition-definitions.js --json
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');
const DEFAULT_RUN_IDS = ['eval-2026-02-06-81f2d5a1', 'eval-2026-02-06-ac9ea8f5'];
const DEFAULT_JUDGE_PATTERN = 'claude-opus%';
const DEFAULT_BALANCED_PER_CELL = 30;

const DEFAULT_PROFILE_MAP = {
  base_nomem: 'cell_1_base_single_unified',
  base_mem: 'cell_19_memory_single_unified',
  recog_nomem: 'cell_20_recog_nomem_single_unified',
  recog_mem: 'cell_5_recog_single_unified',
};

function mean(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
  if (arr.length < 2) return null;
  const m = mean(arr);
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function cohenD(group1, group2) {
  if (group1.length < 2 || group2.length < 2) return null;
  const sd1 = standardDeviation(group1);
  const sd2 = standardDeviation(group2);
  if (!Number.isFinite(sd1) || !Number.isFinite(sd2)) return null;
  const pooled = Math.sqrt(
    ((group1.length - 1) * sd1 ** 2 + (group2.length - 1) * sd2 ** 2) / (group1.length + group2.length - 2),
  );
  if (!Number.isFinite(pooled) || pooled === 0) return null;
  return (mean(group1) - mean(group2)) / pooled;
}

function summarizeContrast(label, groupA, groupB) {
  const mA = mean(groupA);
  const mB = mean(groupB);
  return {
    label,
    nA: groupA.length,
    nB: groupB.length,
    meanA: mA,
    meanB: mB,
    delta: mA != null && mB != null ? mA - mB : null,
    d: cohenD(groupA, groupB),
  };
}

function formatNum(v, digits = 2) {
  if (!Number.isFinite(v)) return 'n/a';
  return v.toFixed(digits);
}

function parseArgs(argv) {
  const options = {
    dbPath: DEFAULT_DB_PATH,
    runIds: DEFAULT_RUN_IDS.slice(),
    judgePattern: DEFAULT_JUDGE_PATTERN,
    balancedPerCell: DEFAULT_BALANCED_PER_CELL,
    json: false,
    profileMap: { ...DEFAULT_PROFILE_MAP },
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--db' && argv[i + 1]) {
      options.dbPath = argv[++i];
    } else if (arg === '--run-ids' && argv[i + 1]) {
      options.runIds = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--judge-pattern' && argv[i + 1]) {
      options.judgePattern = argv[++i];
    } else if (arg === '--balanced-per-cell' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n > 0) options.balancedPerCell = n;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--base-nomem-profile' && argv[i + 1]) {
      options.profileMap.base_nomem = argv[++i];
    } else if (arg === '--base-mem-profile' && argv[i + 1]) {
      options.profileMap.base_mem = argv[++i];
    } else if (arg === '--recog-nomem-profile' && argv[i + 1]) {
      options.profileMap.recog_nomem = argv[++i];
    } else if (arg === '--recog-mem-profile' && argv[i + 1]) {
      options.profileMap.recog_mem = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/analyze-recognition-definitions.js [options]

Options:
  --db <path>                        SQLite DB path (default: ${DEFAULT_DB_PATH})
  --run-ids <id1,id2,...>            Run IDs to include (default memory-isolation runs)
  --judge-pattern <like>             SQL LIKE filter for judge_model (default: ${DEFAULT_JUDGE_PATTERN})
  --balanced-per-cell <n>            Target per-cell sample size for balanced view (default: ${DEFAULT_BALANCED_PER_CELL})
  --base-nomem-profile <name>        Override base/no-memory profile name
  --base-mem-profile <name>          Override base/memory profile name
  --recog-nomem-profile <name>       Override recognition/no-memory profile name
  --recog-mem-profile <name>         Override recognition/memory profile name
  --json                             Print JSON instead of text table
  --help, -h                         Show this help
`);
      process.exit(0);
    }
  }

  if (options.runIds.length === 0) {
    throw new Error('No run IDs provided. Use --run-ids <id1,id2,...>');
  }

  return options;
}

function loadCellRows(db, { runIds, judgePattern, profileMap }) {
  const profileNames = Object.values(profileMap);
  const runPlaceholders = runIds.map(() => '?').join(',');
  const profilePlaceholders = profileNames.map(() => '?').join(',');

  const sql = `
    SELECT id, run_id, profile_name, overall_score, judge_model
    FROM evaluation_results
    WHERE run_id IN (${runPlaceholders})
      AND success = 1
      AND overall_score IS NOT NULL
      AND judge_model LIKE ?
      AND profile_name IN (${profilePlaceholders})
    ORDER BY id
  `;

  const rows = db.prepare(sql).all(...runIds, judgePattern, ...profileNames);
  const byCell = {
    base_nomem: [],
    base_mem: [],
    recog_nomem: [],
    recog_mem: [],
  };

  for (const row of rows) {
    for (const [cellKey, profileName] of Object.entries(profileMap)) {
      if (row.profile_name === profileName) {
        byCell[cellKey].push(row);
        break;
      }
    }
  }

  return { rows, byCell };
}

function buildReport(byCell, balancedPerCell) {
  const toScores = (rows) => rows.map((r) => r.overall_score).filter(Number.isFinite);

  const rawScores = {
    base_nomem: toScores(byCell.base_nomem),
    base_mem: toScores(byCell.base_mem),
    recog_nomem: toScores(byCell.recog_nomem),
    recog_mem: toScores(byCell.recog_mem),
  };

  const minAvailable = Math.min(
    rawScores.base_nomem.length,
    rawScores.base_mem.length,
    rawScores.recog_nomem.length,
    rawScores.recog_mem.length,
  );
  const balancedN = Math.min(balancedPerCell, minAvailable);

  const balancedScores = {
    base_nomem: rawScores.base_nomem.slice(0, balancedN),
    base_mem: rawScores.base_mem.slice(0, balancedN),
    recog_nomem: rawScores.recog_nomem.slice(0, balancedN),
    recog_mem: rawScores.recog_mem.slice(0, balancedN),
  };

  const buildContrasts = (scores) => [
    summarizeContrast('no-memory', scores.recog_nomem, scores.base_nomem),
    summarizeContrast('with-memory', scores.recog_mem, scores.base_mem),
    summarizeContrast(
      'pooled-main',
      [...scores.recog_nomem, ...scores.recog_mem],
      [...scores.base_nomem, ...scores.base_mem],
    ),
  ];

  return {
    cellStats: {
      base_nomem: {
        n: rawScores.base_nomem.length,
        mean: mean(rawScores.base_nomem),
        sd: standardDeviation(rawScores.base_nomem),
      },
      base_mem: {
        n: rawScores.base_mem.length,
        mean: mean(rawScores.base_mem),
        sd: standardDeviation(rawScores.base_mem),
      },
      recog_nomem: {
        n: rawScores.recog_nomem.length,
        mean: mean(rawScores.recog_nomem),
        sd: standardDeviation(rawScores.recog_nomem),
      },
      recog_mem: {
        n: rawScores.recog_mem.length,
        mean: mean(rawScores.recog_mem),
        sd: standardDeviation(rawScores.recog_mem),
      },
    },
    unbalanced: {
      contrasts: buildContrasts(rawScores),
      sampleSize: {
        base_nomem: rawScores.base_nomem.length,
        base_mem: rawScores.base_mem.length,
        recog_nomem: rawScores.recog_nomem.length,
        recog_mem: rawScores.recog_mem.length,
      },
    },
    balanced: {
      requestedPerCell: balancedPerCell,
      usedPerCell: balancedN,
      contrasts: buildContrasts(balancedScores),
      sampleSize: {
        base_nomem: balancedScores.base_nomem.length,
        base_mem: balancedScores.base_mem.length,
        recog_nomem: balancedScores.recog_nomem.length,
        recog_mem: balancedScores.recog_mem.length,
      },
    },
  };
}

function printTextReport(config, report) {
  const { cellStats, unbalanced, balanced } = report;
  const contrasts = [
    { name: 'no-memory', unbalanced: unbalanced.contrasts[0], balanced: balanced.contrasts[0] },
    { name: 'with-memory', unbalanced: unbalanced.contrasts[1], balanced: balanced.contrasts[1] },
    { name: 'pooled-main', unbalanced: unbalanced.contrasts[2], balanced: balanced.contrasts[2] },
  ];

  console.log('Recognition Effect Definitions');
  console.log('==============================');
  console.log(`DB: ${config.dbPath}`);
  console.log(`Runs: ${config.runIds.join(', ')}`);
  console.log(`Judge filter: ${config.judgePattern}`);
  console.log('');

  console.log('Cell stats (raw)');
  console.log('----------------');
  for (const [cell, s] of Object.entries(cellStats)) {
    console.log(
      `${cell.padEnd(12)} n=${String(s.n).padStart(3)}  mean=${formatNum(s.mean, 2).padStart(6)}  sd=${formatNum(s.sd, 2).padStart(6)}`,
    );
  }
  console.log('');

  const header = [
    'definition'.padEnd(12),
    'scope'.padEnd(10),
    'n_rec'.padStart(5),
    'n_base'.padStart(6),
    'mean_rec'.padStart(9),
    'mean_base'.padStart(10),
    'delta'.padStart(8),
    'd'.padStart(7),
  ].join('  ');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const row of contrasts) {
    const printRow = (scope, s) => {
      console.log(
        [
          row.name.padEnd(12),
          scope.padEnd(10),
          String(s.nA).padStart(5),
          String(s.nB).padStart(6),
          formatNum(s.meanA, 2).padStart(9),
          formatNum(s.meanB, 2).padStart(10),
          formatNum(s.delta, 2).padStart(8),
          formatNum(s.d, 3).padStart(7),
        ].join('  '),
      );
    };

    printRow('unbalanced', row.unbalanced);
    printRow('balanced', row.balanced);
  }

  console.log('');
  console.log(
    `Balanced per-cell target: ${balanced.requestedPerCell}, used: ${balanced.usedPerCell} (limited by smallest cell)`,
  );
}

function main() {
  const options = parseArgs(process.argv);
  const db = new Database(options.dbPath, { readonly: true });

  const { rows, byCell } = loadCellRows(db, options);
  if (rows.length === 0) {
    console.error('No matching rows found for the requested run/profile/judge filter.');
    process.exit(1);
  }

  const report = buildReport(byCell, options.balancedPerCell);
  const payload = {
    config: {
      dbPath: options.dbPath,
      runIds: options.runIds,
      judgePattern: options.judgePattern,
      profileMap: options.profileMap,
      balancedPerCell: options.balancedPerCell,
    },
    report,
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printTextReport(payload.config, report);
  }
}

main();
