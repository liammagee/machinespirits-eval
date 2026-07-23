import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { tutorStubRecipeConfigHash } from '../services/tutorStubSessionRecipe.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts/tutor-stub.js');

function runCli(arguments_, env = {}) {
  return spawnSync(process.execPath, [CLI, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      TUTOR_STUB_REMEMBER_SETTINGS: '0',
      TUTOR_STUB_TRANSCRIPT_OPEN: '0',
      TUTOR_STUB_SUMMARY_OPEN: '0',
      ...env,
    },
  });
}

function installFakeCodex(directory) {
  const executable = path.join(directory, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const response = input.includes('# Current learner turn')
    ? JSON.stringify({
        classification: {
          turn: {
            summary: 'The learner asks to compare public evidence.',
            request_type: 'conceptual_clarity_request',
            discourse_move: 'repair_request',
            evidence_use: 'specific',
            epistemic_stance: 'tentative',
            affect: 'engaged',
            agency: 'steering',
            scores: {
              conceptual_engagement: { score: 2, reason: 'Relevant comparison.' },
              epistemic_readiness: { score: 3, reason: 'Specific and answerable.' }
            },
            pedagogical_need: 'Compare one public mark.'
          },
          overall: {
            summary: 'The learner tests a public evidence link.',
            trajectory: 'more specific',
            recurring_pattern: 'none yet',
            current_state: 'ready to compare evidence',
            next_best_tutor_move: 'Ask for one concrete contrast.'
          }
        },
        learner_record: { human_discourse: { proof_status: 'unclear' }, notes: 'No proof update.' }
      })
    : 'Take the assay as a fingerprint: which public mark differs between the two coins?';
  if (process.env.FAKE_CODEX_LOG) fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---request---\\n');
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function parseDryRun(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('--list-labs and --lab resolve without any model request', () => {
  const listed = runCli(['--list-labs']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /^pure_chat\tlearner_safe\tstable\tlow/mu);
  assert.match(listed.stdout, /^research_controls\tresearch\texperimental\tmetered_high/mu);

  const resolved = parseDryRun(
    runCli([
      '--lab',
      'human_scaffold',
      '--world',
      'world_005_marrick',
      '--dry-run',
      '--no-trace',
      '--no-remember-settings',
    ]),
  );
  assert.equal(resolved.lab.id, 'human_scaffold');
  assert.equal(resolved.lab.audience, 'learner_safe');
  assert.equal(resolved.world.id, 'world_005_marrick');
  assert.equal(resolved.capabilities.active.includes('learner_reasoning'), true);
  assert.equal(resolved.sessionRecipe.config.lab, 'human_scaffold');
  assert.equal(resolved.sessionRecipe.config.options['register-policy'], 'field');
});

test('informational flags bypass missing recipe and resume preparation', () => {
  const missingRecipe = path.join(os.tmpdir(), `missing-tutor-recipe-${process.pid}.json`);
  const helped = runCli(['--help', '--recipe', missingRecipe]);
  assert.equal(helped.status, 0, helped.stderr);
  assert.match(helped.stdout, /^Usage:/u);

  const listed = runCli(['--list-labs', '--recipe', missingRecipe, '--resume', 'also-missing']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /^pure_chat\t/mu);
});

test('--write-recipe and --recipe round-trip a deterministic resolved config', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-cli-recipe-'));
  const recipePath = path.join(tmp, 'session.json');
  const first = parseDryRun(
    runCli(['--lab', 'pure_chat', '--dry-run', '--no-trace', '--no-remember-settings', '--write-recipe', recipePath]),
  );
  assert.equal(fs.existsSync(recipePath), true);
  const second = parseDryRun(runCli(['--recipe', recipePath, '--dry-run', '--no-trace', '--no-remember-settings']));
  assert.equal(second.lab.id, 'pure_chat');
  assert.equal(second.sessionRecipe.configHash, first.sessionRecipe.configHash);
  assert.equal(second.recipeFile, path.relative(ROOT, recipePath));
  assert.deepEqual(Object.keys(second.sessionRecipe.config.identity.models.tutor).sort(), [
    'baseUrl',
    'cli',
    'model',
    'provider',
    'ref',
    'routingHash',
  ]);
  assert.equal(second.sessionRecipe.config.identity.models.tutor.ref, 'codex.gpt-5.6-terra');
  assert.equal(Object.hasOwn(second.sessionRecipe.config.identity.models.tutor, 'configured'), false);
  assert.equal(Object.hasOwn(second.sessionRecipe.config.identity.models.tutor, 'apiKeyEnv'), false);
  assert.equal(second.recipeSource.drift.ok, true);

  const semanticDrift = runCli([
    '--recipe',
    recipePath,
    '--pressure-turns',
    '2,5',
    '--dry-run',
    '--no-trace',
    '--no-remember-settings',
  ]);
  assert.equal(semanticDrift.status, 1);
  assert.match(semanticDrift.stderr, /recipe configuration drift on option\.pressure-turns/u);
});

test('--resume selects an explicit older trace, fails drift closed, and records acknowledgement', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-cli-resume-'));
  const baseline = parseDryRun(runCli(['--lab', 'pure_chat', '--dry-run', '--no-trace', '--no-remember-settings']));
  const explicitPath = path.join(tmp, 'explicit.jsonl');
  const newerPath = path.join(tmp, 'newer.jsonl');
  const writeTrace = (filePath, runId, learner) =>
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ type: 'run_start', runId, metadata: { sessionRecipe: baseline.sessionRecipe } }),
        JSON.stringify({ type: 'turn_complete', runId, turnRecord: { turn: 1, learner, tutor: 'Saved reply.' } }),
        '',
      ].join('\n'),
    );
  writeTrace(explicitPath, 'explicit-run', 'Explicit learner line.');
  writeTrace(newerPath, 'newer-run', 'Newer learner line.');
  const now = Date.now() / 1000;
  fs.utimesSync(explicitPath, now - 30, now - 30);
  fs.utimesSync(newerPath, now, now);

  const resumed = parseDryRun(runCli(['--resume', explicitPath, '--dry-run', '--no-trace', '--no-remember-settings']));
  assert.equal(resumed.resume.runId, 'explicit-run');
  assert.equal(resumed.resume.source, path.relative(ROOT, explicitPath));
  assert.equal(resumed.resume.drift.ok, true);

  const rejected = runCli([
    '--resume',
    explicitPath,
    '--model',
    'openai.mini',
    '--dry-run',
    '--no-trace',
    '--no-remember-settings',
  ]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /resume configuration drift/u);
  assert.match(rejected.stderr, /--acknowledge-drift/u);

  const acknowledged = parseDryRun(
    runCli([
      '--resume',
      explicitPath,
      '--model',
      'openai.mini',
      '--acknowledge-drift',
      '--dry-run',
      '--no-trace',
      '--no-remember-settings',
    ]),
  );
  assert.equal(acknowledged.resume.drift.ok, false);
  assert.equal(acknowledged.resume.driftAcknowledged, true);
  assert.equal(
    acknowledged.resume.drift.drift.some((entry) => entry.axis === 'model.tutor'),
    true,
  );

  const ambiguous = runCli([
    '--resume',
    explicitPath,
    '--resume-last',
    '--dry-run',
    '--no-trace',
    '--no-remember-settings',
  ]);
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /--resume and --resume-last are mutually exclusive/u);
});

test('a valid loaded recipe fails closed when its resolved model route is stale', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-stale-recipe-'));
  const recipePath = path.join(tmp, 'stale.json');
  const baseline = parseDryRun(runCli(['--lab', 'pure_chat', '--dry-run', '--no-trace', '--no-remember-settings']));
  const stale = structuredClone(baseline.sessionRecipe);
  stale.config.identity.models.tutor.model = 'gpt-5.6-terra-stale-target';
  stale.config.identity.models.tutor.routingHash = 'stale-route-hash';
  stale.configHash = tutorStubRecipeConfigHash(stale.config);
  fs.writeFileSync(recipePath, `${JSON.stringify(stale, null, 2)}\n`);

  const rejected = runCli(['--recipe', recipePath, '--dry-run', '--no-trace', '--no-remember-settings']);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /recipe configuration drift on model\.tutor/u);
  assert.match(rejected.stderr, /--acknowledge-drift/u);

  const acknowledged = parseDryRun(
    runCli(['--recipe', recipePath, '--acknowledge-drift', '--dry-run', '--no-trace', '--no-remember-settings']),
  );
  assert.equal(acknowledged.recipeSource.drift.ok, false);
  assert.equal(acknowledged.recipeSource.driftAcknowledged, true);
  assert.equal(acknowledged.recipeSource.drift.drift[0].axis, 'model.tutor');
});

test('an explicit lab cannot silently relabel a recipe and acknowledged drift is revalidated', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-lab-recipe-drift-'));
  const recipePath = path.join(tmp, 'research-controls.json');
  const research = parseDryRun(
    runCli(['--lab', 'research_controls', '--dry-run', '--no-trace', '--no-remember-settings']),
  );
  fs.writeFileSync(recipePath, `${JSON.stringify(research.sessionRecipe, null, 2)}\n`);

  const rejected = runCli([
    '--lab',
    'human_scaffold',
    '--recipe',
    recipePath,
    '--dry-run',
    '--no-trace',
    '--no-remember-settings',
  ]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /recipe lab drift/u);
  assert.match(rejected.stderr, /--acknowledge-drift/u);

  const revalidated = runCli([
    '--lab',
    'human_scaffold',
    '--recipe',
    recipePath,
    '--acknowledge-drift',
    '--dry-run',
    '--no-trace',
    '--no-remember-settings',
  ]);
  assert.equal(revalidated.status, 1);
  assert.match(revalidated.stderr, /lab human_scaffold has incompatible options/u);
  assert.match(revalidated.stderr, /--auto-learner is research-only/u);
});

test('representative pure-chat and human-scaffold labs complete with a fake provider and trace their lab recipe', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-lab-fake-'));
  const binDir = path.join(tmp, 'bin');
  const traceDir = path.join(tmp, 'traces');
  const promptLog = path.join(tmp, 'requests.log');
  fs.mkdirSync(binDir, { recursive: true });
  installFakeCodex(binDir);
  const env = {
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    FAKE_CODEX_LOG: promptLog,
    CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
  };

  const pure = runCli(
    ['--lab', 'pure_chat', '--once', 'What should I compare?', '--no-trace', '--no-stream', '--no-remember-settings'],
    env,
  );
  assert.equal(pure.status, 0, pure.stderr || pure.stdout);
  assert.match(pure.stdout, /Take the assay as a fingerprint/u);

  const scaffold = runCli(
    [
      '--lab',
      'human_scaffold',
      '--once',
      'Can we compare the public assay marks?',
      '--world',
      'world_005_marrick',
      '--trace-dir',
      traceDir,
      '--opening-realizer',
      'deterministic',
      '--no-stream',
      '--no-remember-settings',
    ],
    env,
  );
  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);
  const traceFile = fs.readdirSync(traceDir).find((name) => name.endsWith('.jsonl'));
  assert.ok(traceFile);
  const start = fs
    .readFileSync(path.join(traceDir, traceFile), 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((event) => event.type === 'run_start');
  assert.equal(start.metadata.lab.id, 'human_scaffold');
  assert.equal(start.metadata.lab.maturity, 'stable');
  assert.equal(start.metadata.lab.costClass, 'medium');
  assert.equal(start.metadata.sessionRecipe.schema, 'machinespirits.tutor-stub.session-recipe.v1');
  assert.equal(start.metadata.sessionRecipe.config.lab, 'human_scaffold');
  assert.match(fs.readFileSync(promptLog, 'utf8'), /Can we compare the public assay marks\?/u);
});
