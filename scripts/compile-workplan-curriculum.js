#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

import { writeYaml } from '../services/curriculum/curriculumCompiler.js';
import {
  buildWorkplanCurriculum,
  DEFAULT_WORKPLAN_CURRICULUM_STATUSES,
} from '../services/curriculum/workplanCurriculum.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'workplan-curriculum', 'workplan.curriculum.yaml');

export function usage() {
  return `Workplan Curriculum Compiler — project board -> reflective tutor curriculum

Usage:
  npm run curriculum:compile:workplan -- --check
  npm run curriculum:compile:workplan
  npm run curriculum:compile:workplan -- --statuses active,review

Options:
  --statuses <csv>    item statuses to include (default: ${DEFAULT_WORKPLAN_CURRICULUM_STATUSES.join(',')})
  --all               include every item status
  --out <path>        canonical curriculum snapshot (default: exports/workplan-curriculum/workplan.curriculum.yaml)
  --check             validate and compile in memory without writing
  --help, -h          show this help

The chat backend uses the same compiler live, so npm run chat always sees the
current selected workplan items. Snapshots are for inspection and provenance.
Tutor dialogue is not evidence that a card is complete.`;
}

export function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      statuses: { type: 'string' },
      all: { type: 'boolean', default: false },
      out: { type: 'string', default: DEFAULT_OUT },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const statuses = values.all
    ? ['inbox', 'triaged', 'active', 'blocked', 'review', 'done', 'archived', 'dropped']
    : String(values.statuses || DEFAULT_WORKPLAN_CURRICULUM_STATUSES.join(','))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  return {
    statuses: [...new Set(statuses)],
    out: path.resolve(values.out),
    check: values.check,
    help: values.help,
  };
}

export function compileWorkplanCurriculum(args) {
  const curriculum = buildWorkplanCurriculum({
    itemsDir: path.join(ROOT, 'workplan', 'items'),
    statuses: args.statuses,
  });
  if (!args.check) writeYaml(args.out, curriculum);
  return { curriculum };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const { curriculum } = compileWorkplanCurriculum(args);
  const action = args.check ? 'validated in memory' : `wrote ${path.relative(ROOT, args.out)}`;
  console.log(
    `${action}: ${curriculum.modules.length} module(s), ${curriculum.associations.length} prerequisite edge(s)`,
  );
  console.log(curriculum.projection_boundary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
