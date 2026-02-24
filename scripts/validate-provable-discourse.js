#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { runProvableDiscourseAudit } from '../services/provableDiscourse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function usage() {
  console.log(`Usage:
  node scripts/validate-provable-discourse.js [options]

Options:
  --spec <path>            Claim ledger YAML path (default: config/provable-discourse.yaml)
  --json                   Emit JSON report
  --strict                 Exit non-zero on warns (exit code 2)
  --smoke                  Validate statement anchors only (skip DB evidence)
  --refresh-snapshot       Persist current evidence fingerprints/values to snapshot file
  --color                  Force colorized output
  --no-color               Disable colorized output
  --help

Examples:
  node scripts/validate-provable-discourse.js
  node scripts/validate-provable-discourse.js --refresh-snapshot
  node scripts/validate-provable-discourse.js --json --strict
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

function paint(text, enabled, ...codes) {
  if (!enabled || codes.length === 0) return text;
  return `${codes.join('')}${text}${ANSI.reset}`;
}

function statusSymbol(status) {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '⚠';
  return '✗';
}

function statusColor(status) {
  if (status === 'pass') return ANSI.green;
  if (status === 'warn') return ANSI.yellow;
  return ANSI.red;
}

function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4);
}

function printEntry(entry, useColor) {
  console.log(`${paint(statusSymbol(entry.status), useColor, statusColor(entry.status))} ${paint(entry.id, useColor, ANSI.cyan)}`);
  if (entry.description) console.log(`    ${entry.description}`);
  if (entry.statement_occurrences != null) {
    const lineHint = entry.statement_lines?.length > 0 ? ` lines=${entry.statement_lines.join(',')}` : '';
    console.log(`    statement_occurrences=${entry.statement_occurrences}${lineHint}`);
  }
  if (entry.actual_value != null) {
    console.log(`    actual=${formatNumber(entry.actual_value)}`);
    if (entry.assertion?.expected != null) {
      console.log(`    expected=${Array.isArray(entry.assertion.expected) ? JSON.stringify(entry.assertion.expected) : entry.assertion.expected}`);
    }
    if (entry.assertion?.op) console.log(`    op=${entry.assertion.op}`);
  }
  if (entry.details && Object.keys(entry.details).length > 0) {
    const details = { ...entry.details };
    if (details.mean_group1 != null) details.mean_group1 = formatNumber(details.mean_group1);
    if (details.mean_group0 != null) details.mean_group0 = formatNumber(details.mean_group0);
    console.log(`    details=${JSON.stringify(details)}`);
  }
  if (Array.isArray(entry.messages)) {
    for (const message of entry.messages) {
      console.log(`    ${paint('-', useColor, ANSI.gray)} ${message}`);
    }
  }
  if (Array.isArray(entry.remediation) && entry.remediation.length > 0 && entry.status !== 'pass') {
    for (const step of entry.remediation) {
      console.log(`    fix: ${step}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const strictMode = args.includes('--strict');
  const jsonMode = args.includes('--json');
  const smokeMode = args.includes('--smoke');
  const refreshSnapshot = args.includes('--refresh-snapshot');
  const forceColor = args.includes('--color');
  const noColor = args.includes('--no-color') || process.env.NO_COLOR != null;
  const useColor = !jsonMode && !noColor && (forceColor || Boolean(process.stdout.isTTY));
  const specPath = getArgValue(args, '--spec') || 'config/provable-discourse.yaml';

  const report = runProvableDiscourseAudit({
    rootDir: ROOT,
    specPath,
    smokeMode,
    refreshSnapshot,
  });

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(paint('Provable Discourse Audit', useColor, ANSI.bold));
    console.log(`spec=${report.spec_path} paper=${report.paper_path}`);
    if (report.snapshot_written) {
      console.log(`snapshot_updated=${report.snapshot_written}`);
    }

    console.log('\nClaims:');
    for (const claim of report.claims) {
      printEntry(claim, useColor);
    }

  if (report.symmetry.length > 0) {
      console.log('\nSymmetry rules:');
      for (const rule of report.symmetry) {
        printEntry(rule, useColor);
      }
    }

    if (report.coverage.length > 0) {
      console.log('\nCoverage checks:');
      for (const check of report.coverage) {
        printEntry(check, useColor);
      }
    }

    console.log(
      `\nSummary: ${paint(String(report.summary.pass), useColor, ANSI.green)} pass, ${paint(String(report.summary.warn), useColor, ANSI.yellow)} warn, ${paint(String(report.summary.fail), useColor, ANSI.red)} fail`,
    );
  }

  if (report.summary.fail > 0) process.exit(1);
  if (strictMode && report.summary.warn > 0) process.exit(2);
}

main();
