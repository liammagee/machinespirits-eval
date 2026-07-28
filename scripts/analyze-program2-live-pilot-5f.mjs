#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedAnalyzer = path.join(ROOT, 'scripts/analyze-program2-live-pilot-5e.mjs');
const result = spawnSync(
  process.execPath,
  [sharedAnalyzer, '--analysis-phase', '5f', ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
