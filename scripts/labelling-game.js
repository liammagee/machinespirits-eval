#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'node:util';

import { runLabellingGameCli } from '../services/labellingGameCli.js';

const { values } = parseArgs({
  options: {
    dataset: { type: 'string', short: 'd', default: '' },
    coder: { type: 'string', short: 'c', default: '' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage:
  node scripts/labelling-game.js [--dataset <id>] [--coder <id>]

Datasets:
  superego-taxonomy
  tutor-stub-impasses

The same terminal flow is available through:
  npm run tutor:stub -- --labelling-game [--label-dataset <id>] [--label-coder <id>]

Set LABELLING_GAME_CODER in .env to use a local default coder id.`);
} else {
  await runLabellingGameCli({ datasetId: values.dataset, coderId: values.coder });
}
