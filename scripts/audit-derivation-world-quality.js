#!/usr/bin/env node
/**
 * Audit every dramatic-derivation world for proof and authoring quality.
 * Pure computation: no model calls, database access, or generated artifacts.
 *
 * Usage:
 *   npm run derivation:quality
 *   node scripts/audit-derivation-world-quality.js --worlds <directory> [--json]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWorldDirectory } from '../services/dramaticDerivation/worldQuality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const worldsIndex = argv.indexOf('--worlds');
const worldDir = path.resolve(ROOT, worldsIndex >= 0 ? argv[worldsIndex + 1] : 'config/drama-derivation');
const report = auditWorldDirectory(worldDir);

if (argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`world quality: ${report.reports.length} worlds`);
  for (const row of report.reports) {
    const status = row.ok ? 'PASS' : 'FAIL';
    console.log(
      `${status.padEnd(5)} ${String(row.id).padEnd(42)} ${String(row.eligibility || 'load_error').padEnd(15)} ` +
        `${row.minimalProofPaths.length} minimal path${row.minimalProofPaths.length === 1 ? '' : 's'}`,
    );
    for (const issue of row.errors) console.error(`      error [${issue.code}] ${issue.message}`);
    for (const issue of row.warnings) console.log(`      note  [${issue.code}] ${issue.message}`);
  }
  console.log(
    `\n${report.ok ? 'QUALITY PASS' : 'QUALITY FAIL'}: ${report.errors.length} errors, ${report.warnings.length} notes`,
  );
}

process.exitCode = report.ok ? 0 : 1;
