#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import {
  createTutorStubReaderPreflightTransport,
  executeTutorStubReaderAgreementPreflight,
  renderTutorStubReaderAgreementPreflightMarkdown,
} from '../services/tutorStubReaderAgreementPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const READER_AGREEMENT_PREFLIGHT_USAGE = `Usage:
  node scripts/run-reader-agreement-preflight.js \\
    --design config/tutor-stub-frame-refuser-depth-design.v5.json --arm treatment \\
    --corpus frame-refuser-depth-gate1-v5-2026-08-30 \\
    --out exports/reader-preflight-depth-v5-treatment

  node scripts/run-reader-agreement-preflight.js \\
    --design config/tutor-stub-resistant-learner-merged-design.v5.json --face faceA \\
    --corpus resistant-learner-merged-calibration-v5-2026-08-26 --dry-run

Reads archived calibration transcripts with the registered reader panel and
scores the three reader gates (determinate endpoints, eligible votes per seat,
pairwise exact endpoint agreement) with the same code the live gate uses.
Makes reader calls only. Makes no tutor, learner or persona call.

Options:
  --design <path>        registration file (depth, satisfiable or merged design)
  --arm <id>             treatment | reference (depth and satisfiable designs)
  --face <id>            faceA | faceB (merged design)
  --corpus <dirs>        comma-separated archived run directories; relative
                         names resolve under <archive-root>/artifacts/tutor-stub-live
  --archive-root <path>  private archive checkout (default: EVAL_ARCHIVE_DIR
                         or ../machinespirits-eval-private)
  --out <dir>            report directory, created once; refuses to overwrite
  --parallelism <n>      cases read at once (default 2)
  --ceiling <n>          hard cap on reader calls (default: cases x seats x 2)
  --dry-run              list cases, seats and planned calls; make no call

Exit codes: 0 all three reader gates pass; 1 a gate fails; 2 error, or a
reader error left a case without an outcome.`;

function gitOrNull(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function provenance() {
  return {
    commit: gitOrNull('rev-parse', 'HEAD'),
    tree: gitOrNull('rev-parse', 'HEAD^{tree}'),
    dirty: gitOrNull('status', '--porcelain') ? true : false,
  };
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

export function parseReaderAgreementPreflightArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string' },
      arm: { type: 'string' },
      face: { type: 'string' },
      corpus: { type: 'string' },
      'archive-root': { type: 'string' },
      out: { type: 'string' },
      parallelism: { type: 'string', default: '2' },
      ceiling: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (!values.design) throw new Error('--design is required');
  if (!values.corpus) throw new Error('--corpus is required');
  if (!values['dry-run'] && !values.out) throw new Error('--out is required unless --dry-run');
  const parallelism = Number.parseInt(values.parallelism, 10);
  if (!Number.isInteger(parallelism) || parallelism < 1) throw new Error('--parallelism must be a positive integer');
  const ceiling = values.ceiling === undefined ? null : Number.parseInt(values.ceiling, 10);
  if (ceiling !== null && (!Number.isInteger(ceiling) || ceiling < 1)) {
    throw new Error('--ceiling must be a positive integer');
  }
  return {
    help: false,
    designPath: values.design,
    arm: values.arm ?? null,
    face: values.face ?? null,
    corpus: values.corpus
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    archiveRoot: values['archive-root'] ?? null,
    out: values.out ?? null,
    parallelism,
    ceiling,
    dryRun: values['dry-run'],
  };
}

export async function runReaderAgreementPreflightCli(
  argv,
  { callBridge = callAIWithCliBridge, log = console.log } = {},
) {
  const args = parseReaderAgreementPreflightArgs(argv);
  if (args.help) {
    log(READER_AGREEMENT_PREFLIGHT_USAGE);
    return 0;
  }
  const archiveRoot = path.join(
    resolveTutorStubArtifactArchiveDirectory(args.archiveRoot, { cwd: process.cwd(), repoRoot: ROOT }),
    'artifacts',
    'tutor-stub-live',
  );
  const outDirectory = args.out ? path.resolve(args.out) : null;
  if (outDirectory && fs.existsSync(outDirectory)) {
    throw new Error(`--out already exists, choose a new directory: ${outDirectory}`);
  }
  const plan = await executeTutorStubReaderAgreementPreflight({
    designPath: args.designPath,
    arm: args.arm,
    face: args.face,
    runDirectories: args.corpus,
    archiveRoot,
    root: ROOT,
    callPromptModel: null,
    resolveModel,
  });
  const ceiling = args.ceiling ?? plan.corpus.planned_reader_calls * 2;
  if (args.dryRun) {
    log(
      `dry run: ${plan.corpus.cases} case(s) from ${plan.corpus.runs.length} run(s); ` +
        `${plan.readers.length} reader seat(s); ${plan.corpus.planned_reader_calls} planned reader calls; ` +
        `ceiling ${ceiling}; live calls 0`,
    );
    for (const entry of plan.cases) {
      log(
        `  ${entry.case_id} arm=${entry.arm_id ?? '-'} archived=${entry.archived_status}:${entry.archived_endpoint ?? '-'}`,
      );
    }
    log(`not checked here: ${plan.live_only_gates_not_checked.join(', ')}`);
    return 0;
  }
  const transport = createTutorStubReaderPreflightTransport({ callBridge, attemptCeiling: ceiling });
  log(
    `reading ${plan.corpus.cases} case(s) with ${plan.readers.length} seat(s); ` +
      `planned ${plan.corpus.planned_reader_calls} reader calls, ceiling ${ceiling}, parallelism ${args.parallelism}`,
  );
  const report = await executeTutorStubReaderAgreementPreflight({
    designPath: args.designPath,
    arm: args.arm,
    face: args.face,
    runDirectories: args.corpus,
    archiveRoot,
    root: ROOT,
    callPromptModel: transport.callPromptModel,
    resolveModel,
    parallelism: args.parallelism,
    onCase(row) {
      const fresh = row.outcome?.primary?.fields?.[plan.scope.endpoint_field];
      log(
        `  ${row.job.id}: ${row.status}` +
          (fresh ? ` ${fresh.status}:${fresh.value ?? '-'} (archived ${row.archived?.endpoint_value ?? '-'})` : '') +
          (row.error ? ` ${row.error}` : ''),
      );
    },
  });
  report.execution = { ...provenance(), reader_attempts: transport.attempts(), attempt_ceiling: ceiling };
  fs.mkdirSync(outDirectory, { recursive: true });
  writeOnce(path.join(outDirectory, 'report.json'), report);
  writeOnce(path.join(outDirectory, 'report.md'), renderTutorStubReaderAgreementPreflightMarkdown(report));
  log(`${report.status}: ${JSON.stringify(report.gates)}; report at ${outDirectory}`);
  if (report.status === 'passed') return 0;
  if (report.status === 'failed') return 1;
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReaderAgreementPreflightCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 2;
    });
}
