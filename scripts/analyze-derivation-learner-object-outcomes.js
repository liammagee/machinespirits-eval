#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/learner-object-outcomes');
const DEFAULT_SEARCH_DIRS = [
  path.join(ROOT, 'exports/dramatic-derivation/loop'),
  path.join(ROOT, 'exports/dramatic-derivation/episodes'),
  path.join(ROOT, 'exports/dramatic-derivation/ownership-transfer-detector-audit/fresh-runs'),
  path.join(ROOT, 'exports/dramatic-derivation/ownership-transfer-detector-audit/episodes'),
];

function usage() {
  return `Usage:
  node scripts/analyze-derivation-learner-object-outcomes.js \\
    --run <label-or-dir-or-result-json> [--run ...] \\
    [--search-dir exports/dramatic-derivation/loop] \\
    [--out exports/dramatic-derivation/learner-object-outcomes]
`;
}

export function parseArgs(argv = []) {
  const opts = {
    runs: [],
    searchDirs: [...DEFAULT_SEARCH_DIRS],
    out: DEFAULT_OUT,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--run') {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for --run\n${usage()}`);
      opts.runs.push(value);
      continue;
    }
    if (arg === '--search-dir') {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for --search-dir\n${usage()}`);
      opts.searchDirs.push(path.resolve(ROOT, value));
      continue;
    }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for --out\n${usage()}`);
      opts.out = path.resolve(ROOT, value);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function relativePath(file) {
  return path.relative(ROOT, file);
}

function maybeResultFile(candidate) {
  if (!fs.existsSync(candidate)) return null;
  const stat = fs.statSync(candidate);
  if (stat.isDirectory()) {
    const result = path.join(candidate, 'result.json');
    return fs.existsSync(result) ? result : null;
  }
  return path.basename(candidate) === 'result.json' ? candidate : null;
}

export function resolveResultRef(ref, searchDirs = DEFAULT_SEARCH_DIRS) {
  const candidates = [];
  const resolved = path.resolve(ROOT, ref);
  candidates.push(resolved);
  for (const dir of searchDirs) {
    candidates.push(path.join(dir, ref));
    candidates.push(path.join(dir, ref, 'result.json'));
  }
  for (const candidate of candidates) {
    const found = maybeResultFile(candidate);
    if (found) return found;
  }
  throw new Error(`Could not resolve run ref ${JSON.stringify(ref)} to a result.json`);
}

export function finalD(result = {}) {
  const trajectory = Array.isArray(result.trajectory) ? result.trajectory : [];
  for (let i = trajectory.length - 1; i >= 0; i -= 1) {
    const value = Number(trajectory[i]?.D);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function finalRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null;
}

function auditFlag(...values) {
  const present = values.filter((value) => value !== undefined && value !== null);
  if (!present.length) return null;
  return present.every((value) => value === true);
}

function isProofGrounded(result = {}) {
  return result.verdict === 'grounded_anagnorisis';
}

export function classifyOutcome({ result = {}, finalPost = null }) {
  if (!isProofGrounded(result)) return 'proof_failed';
  if (!finalPost) return 'not_instrumented';
  if (finalPost.complete === true && finalPost.status === 'transformed') return 'proof_and_ownership_grounded';
  return 'proof_grounded_ownership_partial';
}

export function analyzeResult(result, { ref = null, resultFile = null } = {}) {
  const finalPost = finalRow(result.learnerTransformationPost);
  const durability = result.learnerTransformationDurability || null;
  const forced = Number.isFinite(Number(result.firstForcedTurn)) ? Number(result.firstForcedTurn) : null;
  const asserted = Number.isFinite(Number(result.assertedGroundedTurn)) ? Number(result.assertedGroundedTurn) : null;
  const forcedToAssertedGap = forced !== null && asserted !== null ? asserted - forced : null;
  const inputAuditOk = auditFlag(finalPost?.inputAuditOk, durability?.inputAudit?.ok);
  const nonLeakAuditOk = auditFlag(finalPost?.nonLeakAuditOk, durability?.nonLeakAudit?.ok);
  return {
    ref,
    resultFile: resultFile ? relativePath(resultFile) : null,
    worldId: result.worldId || null,
    verdict: result.verdict || null,
    turnsPlayed: Number.isFinite(Number(result.turnsPlayed)) ? Number(result.turnsPlayed) : null,
    finalD: finalD(result),
    firstForcedTurn: forced,
    assertedGroundedTurn: asserted,
    forcedToAssertedGap,
    outcome: classifyOutcome({ result, finalPost }),
    ownership: finalPost
      ? {
          turn: finalPost.turn ?? null,
          status: finalPost.status || null,
          complete: finalPost.complete === true,
          ownershipLevel: finalPost.ownershipLevel || null,
          ownershipScore: finalPost.ownershipScore ?? null,
          passedFamilies: finalPost.passedFamilies || [],
          missingFamilies: finalPost.missingFamilies || [],
          finalAssertionAvailable: finalPost.finalAssertionAvailable === true,
          lateOwnershipCheck: finalPost.lateOwnershipCheck === true,
        }
      : null,
    durability: durability
      ? {
          status: durability.status || null,
          durable: durability.durable === true,
          firstCompleteTurn: durability.firstCompleteTurn ?? null,
          finalStatus: durability.finalStatus || null,
          finalComplete: durability.finalComplete === true,
          releaseChallengeCount: durability.releaseChallengeCount ?? null,
          survivedAllReleaseChallenges: durability.survivedAllReleaseChallenges === true,
        }
      : null,
    leakAudit: {
      inputAuditOk,
      nonLeakAuditOk,
      ok: auditFlag(inputAuditOk, nonLeakAuditOk),
    },
  };
}

export function analyzeRefs(refs = [], { searchDirs = DEFAULT_SEARCH_DIRS } = {}) {
  return refs.map((ref) => {
    const resultFile = resolveResultRef(ref, searchDirs);
    return analyzeResult(readJson(resultFile), { ref, resultFile });
  });
}

function summarize(rows) {
  const counts = {
    total: rows.length,
    proof_and_ownership_grounded: 0,
    proof_grounded_ownership_partial: 0,
    proof_failed: 0,
    not_instrumented: 0,
  };
  for (const row of rows) {
    if (Object.hasOwn(counts, row.outcome)) counts[row.outcome] += 1;
  }
  return counts;
}

function missingText(row) {
  if (!row.ownership) return 'n/a';
  return row.ownership.missingFamilies.length ? row.ownership.missingFamilies.join(', ') : 'none';
}

function renderMarkdown(summary) {
  const rows = summary.runs
    .map(
      (row) =>
        `| ${row.ref || row.resultFile} | ${row.verdict || 'null'} | ${row.turnsPlayed ?? 'n/a'} | ${row.finalD ?? 'n/a'} | ${row.firstForcedTurn ?? 'n/a'} | ${row.assertedGroundedTurn ?? 'n/a'} | ${row.forcedToAssertedGap ?? 'n/a'} | ${row.outcome} | ${row.ownership?.status || 'n/a'} | ${missingText(row)} | ${row.durability?.status || 'n/a'} | ${row.leakAudit.ok === null ? 'n/a' : row.leakAudit.ok ? 'ok' : 'fail'} |`,
    )
    .join('\n');
  return `# Learner Object Outcome Report

Generated: ${summary.generatedAt}

## Boundary

- Post-run analysis only.
- Does not change proof control, learner behavior, release policy, or assertion gates.
- \`--ownership-transfer-gate\` remains experimental and off by default.

## Counts

| Outcome | Count |
| --- | ---: |
| proof_and_ownership_grounded | ${summary.counts.proof_and_ownership_grounded} |
| proof_grounded_ownership_partial | ${summary.counts.proof_grounded_ownership_partial} |
| proof_failed | ${summary.counts.proof_failed} |
| not_instrumented | ${summary.counts.not_instrumented} |
| total | ${summary.counts.total} |

## Runs

| Ref | Verdict | Turns | Final D | Forced | Asserted | Gap | Outcome | Final ownership | Missing | Durability | Leak audit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
${rows || '| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |'}

## Interpretation

Use this report to separate proof reliability from learner-object ownership. A grounded proof with partial ownership is not a runtime failure by itself, but it marks a weaker pedagogical endpoint than \`proof_and_ownership_grounded\`.
`;
}

export function buildSummary(refs = [], opts = {}) {
  const runs = analyzeRefs(refs, opts);
  return {
    schema: 'dramatic-derivation.learner-object-outcomes.v0',
    generatedAt: new Date().toISOString(),
    boundary: [
      'post-run analysis only',
      'does not change proof control',
      'ownership-transfer-gate remains experimental and off by default',
    ],
    counts: summarize(runs),
    runs,
  };
}

export function writeReports(summary, outDir = DEFAULT_OUT) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonFile = path.join(outDir, 'summary.json');
  const mdFile = path.join(outDir, 'report.md');
  fs.writeFileSync(jsonFile, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(mdFile, renderMarkdown(summary));
  return { jsonFile, mdFile };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  if (!opts.runs.length) throw new Error(`At least one --run is required.\n${usage()}`);
  const summary = buildSummary(opts.runs, { searchDirs: opts.searchDirs });
  const files = writeReports(summary, opts.out);
  console.log(`learner object outcome report wrote ${relativePath(files.jsonFile)} and ${relativePath(files.mdFile)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
