#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAiFoundationsMarkdown,
  validateCanonicalCurriculum,
  writeYaml,
} from '../services/curriculum/curriculumCompiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'curriculum', 'ai-foundations-adaptive-tutor-curriculum.md');
const DEFAULT_OUTPUT = path.join(ROOT, 'curriculum', 'ai-foundations.curriculum.yaml');

export function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--input') args.input = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--check') args.check = true;
    else throw new Error(`unknown arg: ${token}`);
  }
  return args;
}

export function convertAiFoundationsCurriculum(args) {
  const markdown = fs.readFileSync(args.input, 'utf8');
  const curriculum = parseAiFoundationsMarkdown(markdown, {
    sourcePath: path.relative(ROOT, args.input),
  });
  validateCanonicalCurriculum(curriculum, args.input);
  if (!args.check) writeYaml(args.out, curriculum);
  return curriculum;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const curriculum = convertAiFoundationsCurriculum(args);
  const action = args.check ? 'validated' : `wrote ${path.relative(ROOT, args.out)}`;
  console.log(
    `${action}: ${curriculum.id} (${curriculum.modules.length} modules, ${curriculum.modules.reduce(
      (sum, module) => sum + module.knowledge_components.length,
      0,
    )} knowledge components)`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
