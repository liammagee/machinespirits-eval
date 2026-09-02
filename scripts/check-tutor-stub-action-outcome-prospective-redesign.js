#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadTutorStubActionOutcomeProspectiveRedesign,
  runTutorStubActionOutcomeProspectiveRedesignPreflight,
} from '../services/tutorStubActionOutcomeProspectiveRedesign.js';

export function main() {
  const loaded = loadTutorStubActionOutcomeProspectiveRedesign();
  const result = runTutorStubActionOutcomeProspectiveRedesignPreflight({ loaded });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'passed_zero_call') process.exitCode = 1;
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
