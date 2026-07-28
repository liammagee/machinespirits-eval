#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

import {
  renderProgram2Phase5eWorldSelectionMarkdown,
  selectProgram2Phase5eWorld,
} from '../services/program2Phase5eWorldSelection.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const { values } = parseArgs({
  options: {
    'world-dir': { type: 'string', default: path.join(repoRoot, 'config/drama-derivation') },
    json: { type: 'string' },
    markdown: { type: 'string' },
  },
});

const result = selectProgram2Phase5eWorld({ worldDir: path.resolve(values['world-dir']) });
if (values.json) {
  const json = await prettier.format(JSON.stringify(result), { parser: 'json' });
  fs.writeFileSync(path.resolve(values.json), json);
}
if (values.markdown)
  fs.writeFileSync(path.resolve(values.markdown), renderProgram2Phase5eWorldSelectionMarkdown(result));
console.log(JSON.stringify(result, null, 2));
