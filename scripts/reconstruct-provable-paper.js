#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import YAML from 'yaml';
import { runProvableDiscourseAudit } from '../services/provableDiscourse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/reconstruct-provable-paper.js [options]

Options:
  --spec <path>              Provable discourse spec (default: config/provable-discourse.yaml)
  --out <path>               Reconstructed paper path (default: notes/paper-full-validatable-YYYY-MM-DD.md)
  --diff-out <path>          Unified diff output path (default: notes/paper-full-validatable-YYYY-MM-DD.diff)
  --fail-only                Remove lines for failed claims only (default: fail + warn)
  --keep-unmapped            Keep inventory-unmapped major claims (default: remove)
  --print-diff               Print full diff to stdout
  --diff-max-lines <n>       Max diff lines to print when not --print-diff (default: 120)
  --no-diff                  Skip generating diff
  --json                     Emit JSON summary
  --help

Examples:
  node scripts/reconstruct-provable-paper.js
  node scripts/reconstruct-provable-paper.js --out notes/paper-full-validatable.md --print-diff
  node scripts/reconstruct-provable-paper.js --fail-only --keep-unmapped
`);
}

function toLocalDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getArgValue(argv, flag) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === flag) {
      const next = i + 1 < argv.length ? argv[i + 1] : null;
      if (next && !next.startsWith('--')) return next;
      return null;
    }
    if (token.startsWith(`${flag}=`)) return token.slice(flag.length + 1);
  }
  return null;
}

function hasFlag(argv, flag) {
  return argv.includes(flag) || argv.some((token) => token.startsWith(`${flag}=`));
}

function resolvePath(baseDir, value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(baseDir, value);
}

function normalizeClaimTextForKey(claimText) {
  let text = String(claimText || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s*([=<>≈])\s*/g, '$1');
  text = text.replace(/[,\.;:]+$/g, '');
  return text;
}

function parseSourceKey(sourceKey) {
  const raw = String(sourceKey || '');
  const first = raw.indexOf('|');
  if (first < 0) return null;
  const second = raw.indexOf('|', first + 1);
  if (second < 0) return null;
  const kind = raw.slice(0, first);
  const lineNo = Number(raw.slice(first + 1, second));
  const claimText = raw.slice(second + 1);
  return {
    kind,
    line_no: Number.isFinite(lineNo) ? lineNo : null,
    claim_text: claimText,
  };
}

function canonicalSourceKeyFromParts({ kind, line_no, claim_text }) {
  if (!kind || !Number.isFinite(line_no)) return null;
  return `${kind}|${line_no}|${normalizeClaimTextForKey(claim_text)}`;
}

function canonicalSourceFamilyFromParts({ kind, claim_text }) {
  if (!kind) return null;
  return `${kind}|${normalizeClaimTextForKey(claim_text)}`;
}

function addLineReason(map, lineNo, reason) {
  if (!Number.isInteger(lineNo) || lineNo < 1) return;
  if (!map.has(lineNo)) map.set(lineNo, new Set());
  map.get(lineNo).add(reason);
}

function parseInventoryPolicy(spec) {
  const policy = spec?.inventory_policy || {};
  const majorOnly = policy.major_only !== false;
  const includeKinds =
    Array.isArray(policy.include_kinds) && policy.include_kinds.length > 0 ? new Set(policy.include_kinds) : null;
  return { majorOnly, includeKinds };
}

function shouldIncludeInventoryEntry(entry, policy) {
  if (!entry) return false;
  if (policy.majorOnly && !entry.is_major) return false;
  if (policy.includeKinds && !policy.includeKinds.has(entry.kind)) return false;
  return true;
}

function runDiff(oldPath, newPath) {
  const diff = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--', oldPath, newPath], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (diff.error) {
    throw diff.error;
  }

  // git diff --no-index exit codes:
  // 0 = no diff, 1 = diff present, >1 = error.
  if ((diff.status ?? 2) > 1) {
    const err = diff.stderr?.trim() || diff.stdout?.trim() || `git diff failed with status ${diff.status}`;
    throw new Error(err);
  }

  return diff.stdout || '';
}

function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    usage();
    process.exit(0);
  }

  const dateStamp = toLocalDateStamp();
  const specPath = getArgValue(args, '--spec') || 'config/provable-discourse.yaml';
  const outPath = getArgValue(args, '--out') || path.join('notes', `paper-full-validatable-${dateStamp}.md`);
  const diffOutPath = getArgValue(args, '--diff-out') || path.join('notes', `paper-full-validatable-${dateStamp}.diff`);
  const failOnly = hasFlag(args, '--fail-only');
  const keepUnmapped = hasFlag(args, '--keep-unmapped');
  const skipDiff = hasFlag(args, '--no-diff');
  const printDiff = hasFlag(args, '--print-diff');
  const jsonMode = hasFlag(args, '--json');
  const diffMaxLinesRaw = getArgValue(args, '--diff-max-lines');
  const diffMaxLinesParsed = diffMaxLinesRaw == null ? 120 : Number(diffMaxLinesRaw);
  const diffMaxLines = Number.isFinite(diffMaxLinesParsed) && diffMaxLinesParsed > 0 ? diffMaxLinesParsed : 120;

  const audit = runProvableDiscourseAudit({
    rootDir: ROOT,
    specPath,
    smokeMode: false,
    refreshSnapshot: false,
  });

  const specAbsPath = resolvePath(ROOT, specPath);
  const spec = YAML.parse(fs.readFileSync(specAbsPath, 'utf8')) || {};
  const paperAbsPath = resolvePath(ROOT, audit.paper_path);
  const inventoryAbsPath = audit.inventory_path ? resolvePath(ROOT, audit.inventory_path) : null;
  const outputAbsPath = resolvePath(ROOT, outPath);
  const outputDiffAbsPath = resolvePath(ROOT, diffOutPath);

  const lineReasons = new Map();
  const removableStatuses = failOnly ? new Set(['fail']) : new Set(['fail', 'warn']);

  for (const claim of audit.claims || []) {
    if (!removableStatuses.has(claim.status)) continue;
    for (const lineNo of claim.statement_lines || []) {
      addLineReason(lineReasons, lineNo, `claim:${claim.id}:${claim.status}`);
    }
  }

  const mappedCanonicalKeys = new Set();
  const mappedFamilies = new Set();
  for (const claim of audit.claims || []) {
    for (const key of claim.source_keys || []) {
      const parsed = parseSourceKey(key);
      if (!parsed) continue;
      const canonicalKey = canonicalSourceKeyFromParts(parsed);
      const canonicalFamily = canonicalSourceFamilyFromParts(parsed);
      if (canonicalKey) mappedCanonicalKeys.add(canonicalKey);
      if (canonicalFamily) mappedFamilies.add(canonicalFamily);
    }
  }

  let unmappedMajorCount = 0;
  if (!keepUnmapped && inventoryAbsPath && fs.existsSync(inventoryAbsPath)) {
    const inventory = JSON.parse(fs.readFileSync(inventoryAbsPath, 'utf8'));
    const entries = Array.isArray(inventory?.entries) ? inventory.entries : [];
    const policy = parseInventoryPolicy(spec);
    for (const entry of entries) {
      if (!shouldIncludeInventoryEntry(entry, policy)) continue;
      const canonicalKey = canonicalSourceKeyFromParts(entry);
      const canonicalFamily = canonicalSourceFamilyFromParts(entry);
      if (canonicalKey && mappedCanonicalKeys.has(canonicalKey)) continue;
      if (canonicalFamily && mappedFamilies.has(canonicalFamily)) continue;
      unmappedMajorCount++;
      addLineReason(lineReasons, entry.line_no, `inventory_unmapped:${entry.source_key}`);
    }
  }

  const original = fs.readFileSync(paperAbsPath, 'utf8').split(/\r?\n/);
  const reconstructed = original.map((line, index) => {
    const lineNo = index + 1;
    const reasons = lineReasons.get(lineNo);
    if (!reasons || line.trim() === '') return line;
    const reasonText = [...reasons].slice(0, 3).join(', ');
    return `<!-- VALIDATION_FILTER_REMOVED line ${lineNo}: ${reasonText} -->`;
  });

  fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
  fs.writeFileSync(outputAbsPath, `${reconstructed.join('\n')}\n`, 'utf8');

  let diffText = '';
  if (!skipDiff) {
    diffText = runDiff(paperAbsPath, outputAbsPath);
    fs.mkdirSync(path.dirname(outputDiffAbsPath), { recursive: true });
    fs.writeFileSync(outputDiffAbsPath, diffText, 'utf8');
  }

  const removedLines = [...lineReasons.keys()].length;
  const summary = {
    spec_path: path.relative(ROOT, specAbsPath),
    paper_path: path.relative(ROOT, paperAbsPath),
    out_path: path.relative(ROOT, outputAbsPath),
    diff_out_path: skipDiff ? null : path.relative(ROOT, outputDiffAbsPath),
    removed_lines: removedLines,
    unmapped_major_claims_flagged: keepUnmapped ? 0 : unmappedMajorCount,
    audit_summary: audit.summary,
    fail_only: failOnly,
    keep_unmapped: keepUnmapped,
  };

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('Provable Paper Reconstruction');
    console.log(`spec=${summary.spec_path}`);
    console.log(`paper=${summary.paper_path}`);
    console.log(`out=${summary.out_path}`);
    if (!skipDiff) console.log(`diff=${summary.diff_out_path}`);
    console.log(
      `removed_lines=${summary.removed_lines} (fail=${audit.summary?.fail || 0}, warn=${audit.summary?.warn || 0}, unmapped_major=${summary.unmapped_major_claims_flagged})`,
    );

    if (!skipDiff) {
      const lines = diffText.split('\n');
      if (printDiff || lines.length <= diffMaxLines) {
        console.log('\nDiff:\n');
        console.log(diffText);
      } else {
        console.log(`\nDiff (first ${diffMaxLines} lines of ${lines.length}):\n`);
        console.log(lines.slice(0, diffMaxLines).join('\n'));
        console.log(`\n... truncated; full diff saved to ${summary.diff_out_path}`);
      }
    }
  }
}

main();
