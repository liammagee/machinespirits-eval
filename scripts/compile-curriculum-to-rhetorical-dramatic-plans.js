#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileCurriculumToRhetoricalDramaticPlans,
  loadCanonicalCurriculum,
  writeYaml,
} from '../services/curriculum/curriculumCompiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'curriculum', 'ai-foundations.curriculum.yaml');
const DEFAULT_OUTPUT = path.join(ROOT, 'curriculum', 'ai-foundations.rhetorical-dramatic-plans.yaml');

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    mode: 'mvp',
    arms: [],
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--input') args.input = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--mode') args.mode = argv[++i];
    else if (token === '--all') args.mode = 'all';
    else if (token === '--mvp') args.mode = 'mvp';
    else if (token === '--arm') args.arms = [...args.arms, ...splitCsv(argv[++i])];
    else if (token === '--arms') args.arms = splitCsv(argv[++i]);
    else if (token === '--check') args.check = true;
    else throw new Error(`unknown arg: ${token}`);
  }
  args.arms = [...new Set(args.arms)];
  if (!args.arms.length) args.arms = ['adaptive_curriculum_drama'];
  if (!['all', 'mvp'].includes(args.mode)) throw new Error('--mode must be all|mvp');
  return args;
}

export function compileCurriculumRhetoricalDramaticPlanFile(args) {
  const curriculum = loadCanonicalCurriculum(args.input);
  const spec = compileCurriculumToRhetoricalDramaticPlans(curriculum, { mode: args.mode, arms: args.arms });
  if (!args.check) writeYaml(args.out, spec);
  return spec;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = compileCurriculumRhetoricalDramaticPlanFile(args);
  const action = args.check ? 'validated' : `wrote ${path.relative(ROOT, args.out)}`;
  console.log(
    `${action}: ${spec.rhetorical_dramatic_plans.length} rhetorical dramatic plan(s), mode=${spec.meta.mode}, arms=${spec.meta.arms.join(',')}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
