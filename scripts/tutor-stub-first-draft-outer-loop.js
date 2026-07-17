#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  loadTutorStubFirstDraftOuterLoop,
  summarizeTutorStubFirstDraftOuterLoop,
  validateTutorStubFirstDraftOuterLoop,
} from '../services/tutorStubFirstDraftOuterLoop.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-outer-loop-v1.yaml');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    manifest: { type: 'string', default: DEFAULT_MANIFEST },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/tutor-stub-first-draft-outer-loop.js validate [--manifest <path>] [--json]
  node scripts/tutor-stub-first-draft-outer-loop.js status [--manifest <path>] [--json]

Both commands are read-only and make no model calls. validate checks the
version/state protocol and its focused working-screen contract. status also
shows the current state, seed disposition, and permitted next transitions.`;
}

function printStatus(status) {
  console.log(`${status.label} first-draft outer loop: ${status.currentState}`);
  console.log(`terminal scope: ${status.terminalScope}; outcome: ${status.outcome}`);
  console.log(
    `working screen: ${status.workingScreen.id} / ${status.workingScreen.cell} / turns ${status.workingScreen.turns.join(', ')}`,
  );
  console.log(
    `development seed: ${status.developmentSeeds.map((entry) => `${entry.seed} (${entry.status})`).join(', ')}`,
  );
  console.log(
    `held-out matrix: ${status.heldOutMatrixStatus}; acceptance config: ${status.acceptancePredeclared ? 'predeclared' : 'not predeclared'}`,
  );
  console.log('next permitted transitions:');
  for (const transition of status.next) {
    const version = transition.versionAction === 'none' ? '' : `; ${transition.versionAction}`;
    console.log(`  ${transition.state} [${transition.terminalScope}] — ${transition.when}${version}`);
  }
}

if (args.help) {
  console.log(usage());
  process.exit(0);
}

const command = positionals[0] || 'status';
if (!['validate', 'status'].includes(command) || positionals.length > 1) {
  console.error(usage());
  process.exit(1);
}

try {
  const loaded = loadTutorStubFirstDraftOuterLoop(args.manifest, { root: ROOT });
  if (command === 'validate') {
    const validation = validateTutorStubFirstDraftOuterLoop({ manifest: loaded.manifest, root: ROOT });
    if (args.json) console.log(JSON.stringify({ ...validation, manifestPath: loaded.manifestPath }, null, 2));
    else {
      console.log(
        `${loaded.manifestPath}: valid ${validation.currentState} ${validation.currentVersion}; ` +
          `${validation.workingScreen.cell} ${validation.workingScreen.turns.length}/4 frozen turns; ` +
          `acceptance ${validation.acceptancePredeclared ? 'predeclared' : 'not predeclared'}`,
      );
    }
  } else {
    const status = summarizeTutorStubFirstDraftOuterLoop({ manifest: loaded.manifest, root: ROOT });
    if (args.json) console.log(JSON.stringify({ ...status, manifestPath: loaded.manifestPath }, null, 2));
    else printStatus(status);
  }
} catch (error) {
  console.error(`outer-loop ${command} failed: ${error.message}`);
  process.exitCode = 1;
}
