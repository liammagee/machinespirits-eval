#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { auditProgram2StallArchives, renderProgram2StallAuditMarkdown } from '../services/program2StallAudit.js';

const { values } = parseArgs({
  options: {
    'archive-root': { type: 'string', multiple: true, default: [] },
    out: { type: 'string', default: 'exports/program2-stall-corpus-audit' },
    'include-rows': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(
    'Usage: node scripts/audit-program2-stall-corpus.mjs [--archive-root <label=path>...] [--out <dir>] [--include-rows]',
  );
  process.exit(0);
}

const dataHome = process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data');
const defaults = [
  ['step4', path.join(dataHome, 'step4-claim-runs-2026-07')],
  ['phase5', path.join(dataHome, 'program-2', 'phase5-live-pilot')],
  ['phase5b', path.join(dataHome, 'program-2', 'phase5b-live')],
  ['phase5c', path.join(dataHome, 'program-2', 'phase5c-live')],
];
const rootSpecs = values['archive-root'].length
  ? values['archive-root'].map((entry) => {
      const separator = entry.indexOf('=');
      if (separator <= 0) throw new Error(`--archive-root must be label=path, got ${entry}`);
      return { label: entry.slice(0, separator), root: entry.slice(separator + 1) };
    })
  : defaults.map(([label, root]) => ({ label, root }));

const result = auditProgram2StallArchives(rootSpecs);
const output = values['include-rows'] ? result : { ...result, rows: undefined };
const outDir = path.resolve(values.out);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'summary.md'), renderProgram2StallAuditMarkdown(result));
console.log(JSON.stringify(output, null, 2));
