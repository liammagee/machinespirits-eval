#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProvableDiscourseAudit } from '../services/provableDiscourse.js';
import { parseEpochArg, printEpochBanner } from '../services/epochFilter.js';

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
  --write-todo [path]      Write Markdown TODO list (default: notes/provable-discourse-todos-YYYY-MM-DD.md)
  --todo-path <path>       Explicit TODO output path (same as --write-todo <path>)
  --color                  Force colorized output
  --no-color               Disable colorized output
  --graph                  Output dependency graph in DOT format (Graphviz)
  --epoch <epoch>          Filter claims by epoch: pilot (Paper 1.0), 2.0 (default), all
  --help

Examples:
  node scripts/validate-provable-discourse.js
  node scripts/validate-provable-discourse.js --write-todo
  node scripts/validate-provable-discourse.js --write-todo notes/paper-todos-2026-02-24.md
  node scripts/validate-provable-discourse.js --refresh-snapshot
  node scripts/validate-provable-discourse.js --json --strict
`);
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

function toLocalDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDefaultTodoPath() {
  return path.join('notes', `provable-discourse-todos-${toLocalDateStamp()}.md`);
}

function collectEntries(report) {
  return [...(report.claims || []), ...(report.symmetry || []), ...(report.coverage || [])];
}

function formatAssertion(entry) {
  if (entry.actual_value == null) return null;
  const expected = entry.assertion?.expected;
  const op = entry.assertion?.op || null;
  if (expected == null && !op) return `actual=${formatNumber(entry.actual_value)}`;
  const expectedText = Array.isArray(expected) ? JSON.stringify(expected) : expected;
  return `actual=${formatNumber(entry.actual_value)} op=${op || 'n/a'} expected=${expectedText}`;
}

function uniqueSteps(steps) {
  return [...new Set((steps || []).map((s) => String(s || '').trim()).filter(Boolean))];
}

function buildTodoMarkdown(report) {
  const entries = collectEntries(report);
  const failed = entries.filter((entry) => entry.status === 'fail');
  const warned = entries.filter((entry) => entry.status === 'warn');
  const generatedAt = new Date().toISOString();
  const lines = [
    `# Provable Discourse TODOs - ${toLocalDateStamp()}`,
    '',
    `Generated: ${generatedAt}`,
    `Spec: ${report.spec_path}`,
    `Paper: ${report.paper_path}`,
    `Summary: pass=${report.summary?.pass || 0}, warn=${report.summary?.warn || 0}, fail=${report.summary?.fail || 0}`,
    '',
    '## Priority Fixes (Fails)',
  ];

  if (failed.length === 0) {
    lines.push('- None');
  } else {
    for (const entry of failed) {
      lines.push(`- [ ] \`${entry.id}\`${entry.description ? ` - ${entry.description}` : ''}`);
      const assertionText = formatAssertion(entry);
      if (assertionText) lines.push(`  - ${assertionText}`);
      if (entry.statement_occurrences != null && entry.statement_occurrences === 0) {
        lines.push('  - statement not found in paper');
      }
      for (const message of entry.messages || []) {
        lines.push(`  - note: ${message}`);
      }
      const remediations = uniqueSteps(entry.remediation);
      if (remediations.length > 0) {
        lines.push('  - remediation:');
        for (const step of remediations) {
          lines.push(`    - ${step}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('## Secondary Follow-ups (Warns)');
  if (warned.length === 0) {
    lines.push('- None');
  } else {
    for (const entry of warned) {
      lines.push(`- [ ] \`${entry.id}\`${entry.description ? ` - ${entry.description}` : ''}`);
      const assertionText = formatAssertion(entry);
      if (assertionText) lines.push(`  - ${assertionText}`);
      for (const message of entry.messages || []) {
        lines.push(`  - note: ${message}`);
      }
      const remediations = uniqueSteps(entry.remediation);
      for (const step of remediations) {
        lines.push(`  - ${step}`);
      }
    }
  }

  lines.push('');
  lines.push('## Suggested Runbook');
  lines.push('- `npm run paper:provable-discourse:bootstrap`');
  lines.push('- `npm run paper:provable-discourse`');
  lines.push('- `npm run paper:provable-discourse:augment` (launch Codex to review + patch evidence/assertions)');
  lines.push('- `npm run paper:provable-discourse:refresh-snapshot` (after accepted claim updates)');
  lines.push('- Re-run this command with `--write-todo` to refresh this checklist.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeTodoFile({ baseDir, todoPath, report }) {
  const resolvedTodoPath = path.isAbsolute(todoPath) ? todoPath : path.join(baseDir, todoPath);
  fs.mkdirSync(path.dirname(resolvedTodoPath), { recursive: true });
  fs.writeFileSync(resolvedTodoPath, buildTodoMarkdown(report), 'utf8');
  return path.relative(baseDir, resolvedTodoPath);
}

function printEntry(entry, useColor) {
  console.log(
    `${paint(statusSymbol(entry.status), useColor, statusColor(entry.status))} ${paint(entry.id, useColor, ANSI.cyan)}`,
  );
  if (entry.description) console.log(`    ${entry.description}`);
  if (entry.statement_occurrences != null) {
    const lineHint = entry.statement_lines?.length > 0 ? ` lines=${entry.statement_lines.join(',')}` : '';
    console.log(`    statement_occurrences=${entry.statement_occurrences}${lineHint}`);
  }
  if (entry.actual_value != null) {
    console.log(`    actual=${formatNumber(entry.actual_value)}`);
    if (entry.assertion?.expected != null) {
      console.log(
        `    expected=${Array.isArray(entry.assertion.expected) ? JSON.stringify(entry.assertion.expected) : entry.assertion.expected}`,
      );
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
  const graphMode = args.includes('--graph');
  const refreshSnapshot = args.includes('--refresh-snapshot');
  const writeTodoFlag = hasFlag(args, '--write-todo');
  const writeTodoArg = getArgValue(args, '--write-todo');
  const todoPathArg = getArgValue(args, '--todo-path');
  const todoPath = todoPathArg || writeTodoArg || (writeTodoFlag ? buildDefaultTodoPath() : null);
  const forceColor = args.includes('--color');
  const noColor = args.includes('--no-color') || process.env.NO_COLOR != null;
  const useColor = !jsonMode && !noColor && (forceColor || Boolean(process.stdout.isTTY));
  const specPath = getArgValue(args, '--spec') || 'config/provable-discourse.yaml';
  const epoch = parseEpochArg(process.argv);
  printEpochBanner(epoch);

  const report = runProvableDiscourseAudit({
    rootDir: ROOT,
    specPath,
    smokeMode,
    refreshSnapshot,
    epoch: epoch || null,
  });
  if (todoPath) {
    report.todo_written = writeTodoFile({
      baseDir: ROOT,
      todoPath,
      report,
    });
  }

  if (graphMode) {
    const graph = report.dependency_graph || {};
    const claimStatusMap = new Map((report.claims || []).map((c) => [c.id, c.status]));
    const lines = ['digraph claims {', '  rankdir=LR;', '  node [shape=box, style=filled];'];
    for (const id of graph.evaluation_order || []) {
      const status = claimStatusMap.get(id) || 'pass';
      const color = status === 'pass' ? '#90EE90' : status === 'warn' ? '#FFD700' : '#FF6B6B';
      const blocked = (graph.blocked_claims || []).some((b) => b.id === id);
      const fillColor = blocked ? '#D3D3D3' : color;
      lines.push(`  "${id}" [fillcolor="${fillColor}"];`);
    }
    for (const edge of graph.edges || []) {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    }
    lines.push('}');
    console.log(lines.join('\n'));
    process.exit(0);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(paint('Provable Discourse Audit', useColor, ANSI.bold));
    console.log(`spec=${report.spec_path} paper=${report.paper_path}`);
    if (report.snapshot_written) {
      console.log(`snapshot_updated=${report.snapshot_written}`);
    }
    if (report.todo_written) {
      console.log(`todo_written=${report.todo_written}`);
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

    if (report.dependency_graph) {
      const dg = report.dependency_graph;
      const edgeCount = (dg.edges || []).length;
      if (edgeCount > 0) {
        const blockedCount = (dg.blocked_claims || []).length;
        console.log(`\nDependency Graph:`);
        console.log(`  Total edges: ${edgeCount}`);
        console.log(`  Max depth: ${dg.max_depth || 0}`);
        if (blockedCount > 0) {
          console.log(
            `  ${paint(`Blocked claims: ${blockedCount}`, useColor, ANSI.yellow)} (due to upstream failures)`,
          );
        }
      }
    }

    const epochSuffix =
      report.summary.skipped_by_epoch > 0 ? ` (${report.summary.skipped_by_epoch} skipped by epoch filter)` : '';
    console.log(
      `\nSummary: ${paint(String(report.summary.pass), useColor, ANSI.green)} pass, ${paint(String(report.summary.warn), useColor, ANSI.yellow)} warn, ${paint(String(report.summary.fail), useColor, ANSI.red)} fail${epochSuffix}`,
    );
  }

  if (report.summary.fail > 0) process.exit(1);
  if (strictMode && report.summary.warn > 0) process.exit(2);
}

main();
