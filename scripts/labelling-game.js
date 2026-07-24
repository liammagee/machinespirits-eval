#!/usr/bin/env node

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { runLabellingGameCli } from '../services/labellingGameCli.js';

const HELP = `Usage:
  node scripts/labelling-game.js [--dataset <id>] [--coder <id>]

Datasets:
  superego-taxonomy
  tutor-stub-impasses

The same terminal flow is available through:
  npm run tutor:stub -- --labelling-game [--label-dataset <id>] [--label-coder <id>]

Set LABELLING_GAME_CODER in .env to use a local default coder id.`;

export async function runLabellingGameScript(
  argv = process.argv.slice(2),
  { input = process.stdin, output = process.stdout, errorOutput = process.stderr, env = process.env } = {},
) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        dataset: { type: 'string', short: 'd', default: '' },
        coder: { type: 'string', short: 'c', default: '' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
    if (values.help) {
      output.write(`${HELP}\n`);
      return 0;
    }
    await runLabellingGameCli({
      datasetId: values.dataset,
      coderId: values.coder,
      input,
      output,
      env,
    });
    return 0;
  } catch (error) {
    errorOutput.write(`Labelling game failed: ${error.message}\n`);
    return 1;
  }
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = await runLabellingGameScript();
}
