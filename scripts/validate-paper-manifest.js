#!/usr/bin/env node
/**
 * Paper manifest and consistency validation.
 *
 * Usage: node scripts/validate-paper-manifest.js [options]
 *   --fix-status       Mark stalled "running" runs as completed
 *   --deep             Run deep paper-internal consistency checks
 *   --manifest <path>  Override the paper manifest path
 *   --paper <path>     Override the canonical paper path
 *   --db <path>        Override the evaluation database path
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';
import { validatePaperManifest } from '../services/paperManifestValidator.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');

export function getArgValue(argv, flag) {
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === flag) return index + 1 < argv.length ? argv[index + 1] : null;
    if (token.startsWith(`${flag}=`)) return token.slice(flag.length + 1);
  }
  return null;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readText(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function openDatabase(path, fixStatus) {
  if (!existsSync(path)) return null;
  try {
    return new Database(path, { readonly: !fixStatus });
  } catch {
    return null;
  }
}

export function renderPaperManifestResult(result, logger = console.log) {
  for (const entry of result.entries) {
    if (entry.type === 'heading') logger(`\n── ${entry.message} ${'─'.repeat(Math.max(1, 48 - entry.message.length))}`);
    else if (entry.type === 'subheading') logger(`\n  ── ${entry.message} ──`);
    else if (entry.type === 'pass') logger(`  ✓ ${entry.message}`);
    else if (entry.type === 'warn') logger(`  ⚠ ${entry.message}`);
    else if (entry.type === 'fail') logger(`  ✗ ${entry.message}`);
  }

  logger(`\n${'═'.repeat(50)}`);
  logger(`Summary: ${result.passCount} pass, ${result.warnCount} warn, ${result.failCount} fail`);
  if (result.failCount > 0) logger('\nFAILED — fix the issues above before building the paper.');
  else if (result.warnCount > 0) logger('\nPASSED with warnings.');
  else logger('\nALL PASSED ✓');
}

export function runPaperManifestCli(argv = process.argv.slice(2), logger = console.log) {
  const manifestPath = getArgValue(argv, '--manifest') || join(ROOT, 'config', 'paper-manifest.json');
  const paperPath = getArgValue(argv, '--paper') || join(ROOT, 'docs', 'research', 'paper-full.md');
  const databasePath = resolveEvaluationDbPath(ROOT, getArgValue(argv, '--db'));
  const fixStatus = argv.includes('--fix-status');
  const manifest = readJson(manifestPath);
  const paper = readText(paperPath);
  const db = openDatabase(databasePath, fixStatus);

  logger('═══ Paper Consistency Validation ═══');
  logger('═'.repeat(50));
  if (manifest) {
    logger(`\nManifest v${manifest.version} (${manifest.generated})`);
    if (manifest.totals) {
      logger(
        `Expected: ${manifest.totals.evaluations} evaluations, ${manifest.totals.expected_scored?.toLocaleString()} scored`,
      );
    }
  }

  const result = validatePaperManifest({
    manifest,
    db,
    paper,
    fixStatus,
    deep: argv.includes('--deep'),
    manifestPath,
    databasePath,
    paperPath,
  });
  db?.close();
  renderPaperManifestResult(result, logger);
  return result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPaperManifestCli();
}
