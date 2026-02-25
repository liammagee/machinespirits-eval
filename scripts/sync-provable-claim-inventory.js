#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DEFAULT_CLAIM_AUDIT_PATH = path.join(ROOT, 'notes', 'paper-claim-audit.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'config', 'provable-claim-inventory.json');

function usage() {
  console.log(`Usage:
  node scripts/sync-provable-claim-inventory.js [options]

Options:
  --claim-audit <path>      Input claim audit JSON (default: notes/paper-claim-audit.json)
  --out <path>              Output inventory JSON (default: config/provable-claim-inventory.json)
  --help
`);
}

function getArgValue(argv, flag) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === flag) return i + 1 < argv.length ? argv[i + 1] : null;
    if (token.startsWith(`${flag}=`)) return token.slice(flag.length + 1);
  }
  return null;
}

function parseSectionNumber(section) {
  if (typeof section !== 'string') return null;
  if (section.toLowerCase() === 'front matter') return 0;
  const first = section.split('.')[0];
  const number = Number(first);
  return Number.isFinite(number) ? number : null;
}

function classifyMajor(section, claimText) {
  const sectionNum = parseSectionNumber(section);
  const inCoreSection = sectionNum != null && sectionNum >= 0 && sectionNum <= 9;
  const quantPattern = /\bN\s*[=≈]\s*\d|d\s*=\s*-?\d|F\s*=\s*-?\d|r\s*=\s*-?\d|p\s*[<>=]|Δ\s*=|interaction|pts?\b/i;
  return inCoreSection && quantPattern.test(claimText || '');
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

function buildSourceKey(kind, lineNo, claimText) {
  return `${kind}|${lineNo}|${normalizeClaimTextForKey(claimText)}`;
}

function normalizeOutcome(kind, outcome) {
  const claimText = outcome?.claim || '';
  const lineNo = Number(outcome?.line_no || 0);
  const section = outcome?.section || 'unknown';
  const expected = outcome?.expected;
  const hasExpected = typeof expected === 'number' && Number.isFinite(expected);
  return {
    source_key: buildSourceKey(kind, lineNo, claimText),
    kind,
    line_no: lineNo,
    section,
    claim_text: claimText,
    status: outcome?.status || 'unknown',
    reason: outcome?.reason || null,
    has_expected: hasExpected,
    expected: hasExpected ? expected : null,
    value: typeof outcome?.value === 'number' ? outcome.value : null,
    is_major: classifyMajor(section, claimText),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const claimAuditArg = getArgValue(args, '--claim-audit');
  const outArg = getArgValue(args, '--out');
  const claimAuditPath = claimAuditArg
    ? path.isAbsolute(claimAuditArg)
      ? claimAuditArg
      : path.join(ROOT, claimAuditArg)
    : DEFAULT_CLAIM_AUDIT_PATH;
  const outPath = outArg ? (path.isAbsolute(outArg) ? outArg : path.join(ROOT, outArg)) : DEFAULT_OUTPUT_PATH;

  const claimAudit = JSON.parse(fs.readFileSync(claimAuditPath, 'utf8'));
  const nOutcomes = Array.isArray(claimAudit?.n_claim_backtracking?.outcomes) ? claimAudit.n_claim_backtracking.outcomes : [];
  const statOutcomes = Array.isArray(claimAudit?.stat_claim_traceability?.outcomes)
    ? claimAudit.stat_claim_traceability.outcomes
    : [];

  const all = [
    ...nOutcomes.map((outcome) => normalizeOutcome('n', outcome)),
    ...statOutcomes.map((outcome) => normalizeOutcome('stat', outcome)),
  ];

  const dedup = new Map();
  for (const entry of all) {
    if (!dedup.has(entry.source_key)) {
      dedup.set(entry.source_key, entry);
      continue;
    }
    const previous = dedup.get(entry.source_key);
    // Keep the harsher status if duplicates exist.
    const rank = { pass: 0, traceable: 0, warn: 1, unresolved: 1, fail: 2, untraceable: 2, unknown: 1 };
    const prevRank = rank[previous.status] ?? 1;
    const nextRank = rank[entry.status] ?? 1;
    if (nextRank > prevRank) dedup.set(entry.source_key, entry);
  }

  const entries = [...dedup.values()].sort((a, b) => {
    if (a.line_no !== b.line_no) return a.line_no - b.line_no;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.claim_text.localeCompare(b.claim_text);
  });

  const summary = {
    total: entries.length,
    n_claims: entries.filter((entry) => entry.kind === 'n').length,
    stat_claims: entries.filter((entry) => entry.kind === 'stat').length,
    major_total: entries.filter((entry) => entry.is_major).length,
    major_n: entries.filter((entry) => entry.is_major && entry.kind === 'n').length,
    major_stat: entries.filter((entry) => entry.is_major && entry.kind === 'stat').length,
    status_counts: {
      pass: entries.filter((entry) => entry.status === 'pass' || entry.status === 'traceable').length,
      warn: entries.filter((entry) => entry.status === 'warn' || entry.status === 'unresolved').length,
      fail: entries.filter((entry) => entry.status === 'fail' || entry.status === 'untraceable').length,
    },
  };

  const inventory = {
    generated_at: new Date().toISOString(),
    source_claim_audit: path.relative(ROOT, claimAuditPath),
    summary,
    entries,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2), 'utf8');

  console.log(`Wrote ${path.relative(ROOT, outPath)} :: total=${summary.total} major=${summary.major_total}`);
}

main();
