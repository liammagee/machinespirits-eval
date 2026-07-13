import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAFE_TUTOR_RESPONSE =
  "I’m going to give you another piece of information. Let’s role-play it: I’ll be the town assayer voicing Marrick’s ready verdict. Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master’s day. Whatever metal is cast in Marrick, the town says, is cast by Verrell’s hand. Back to the case: what does this new information support without yet proving?";
const UNSAFE_TUTOR_RESPONSE = 'Edony struck the false shillings with the worn burin.';
const PROOF_SKIPPER_RESPONSE = "The graver on Verrell's bench settles it: Verrell struck the shillings.";
const GENERIC_LEARNER_RESPONSE = 'I need more evidence before making a claim.';

function writePromptResponsiveCodex(binDir) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
const logPath = process.env.TUTOR_STUB_PROMPT_BEHAVIOR_LOG;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let role = 'unknown';
  let response = ${JSON.stringify(UNSAFE_TUTOR_RESPONSE)};
  if (input.includes('You are an automated learner in an experimental tutoring dialogue.')) {
    role = 'learner';
    const hasBehaviorCue = input.includes('Recurring behavior: omits the warrant between clue and conclusion.');
    const exposesMeasurement = /Target recurrence|Behavioral signature|Score bands|Coverage velocity|Minimum markers|Must first appear/iu.test(input);
    response = hasBehaviorCue && !exposesMeasurement
      ? ${JSON.stringify(PROOF_SKIPPER_RESPONSE)}
      : ${JSON.stringify(GENERIC_LEARNER_RESPONSE)};
  } else if (input.includes('You are an experimental AI tutor stub.')) {
    role = 'tutor';
    const hasPublicContract =
      input.includes('You are the speaking tutor. You receive only the public scene') &&
      input.includes('Work only from evidence already public or explicitly made available');
    const exposesPrivatePlannerState = [
      'The false shillings were struck by Edony',
      'The old founder\\'s tools were never sold off',
      'p_holder',
      'R1_blank',
      'meltedAt('
    ].some((needle) => input.includes(needle));
    response = hasPublicContract && !exposesPrivatePlannerState
      ? ${JSON.stringify(SAFE_TUTOR_RESPONSE)}
      : ${JSON.stringify(UNSAFE_TUTOR_RESPONSE)};
  }
  if (logPath) fs.appendFileSync(logPath, JSON.stringify({ role, input, response }) + '\\n');
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function readPromptLog(logPath) {
  return fs
    .readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runTutorStub({ tmp, args }) {
  const binDir = path.join(tmp, 'bin');
  const promptLog = path.join(tmp, 'prompt-log.jsonl');
  fs.mkdirSync(binDir, { recursive: true });
  writePromptResponsiveCodex(binDir);
  const result = spawnSync(process.execPath, ['scripts/tutor-stub.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
      CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      TUTOR_STUB_PROMPT_BEHAVIOR_LOG: promptLog,
      TUTOR_STUB_SUMMARY_OPEN: '0',
    },
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return { result, promptLog };
}

function commonArgs(tmp, saveName) {
  return [
    '--world',
    'world_005_marrick',
    '--dag',
    '--dag-mode',
    'defeasible_human_scaffold',
    '--no-classifier',
    '--no-register-selection',
    '--no-opening',
    '--no-closeout-report',
    '--no-interim-animation',
    '--no-stream',
    '--no-remember-settings',
    '--trace-dir',
    path.join(tmp, 'traces'),
    '--save',
    path.join(tmp, saveName),
  ];
}

test('speaking-tutor prompt produces one public, Socratic move without planner leakage', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-prompt-behavior-'));
  try {
    const savePath = path.join(tmp, 'tutor-transcript.json');
    const { promptLog } = runTutorStub({
      tmp,
      args: [
        ...commonArgs(tmp, path.basename(savePath)),
        '--once',
        'The town suspects Verrell because he owns a graver, but that is not tested evidence.',
      ],
    });
    const transcript = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    const turn = transcript.turns[0];
    const requests = readPromptLog(promptLog);
    const tutorRequest = requests.find((request) => request.role === 'tutor');

    assert.ok(tutorRequest, 'expected one speaking-tutor model request');
    assert.match(tutorRequest.input, /Speaking-tutor evidence contract/u);
    assert.match(tutorRequest.input, /Learner says:\s*The town suspects Verrell/u);
    assert.doesNotMatch(
      tutorRequest.input,
      /The false shillings were struck by Edony|The old founder's tools were never sold off|p_holder|R1_blank|meltedAt\(/u,
    );
    assert.equal(turn.tutor, SAFE_TUTOR_RESPONSE);
    assert.equal((turn.tutor.match(/\?/gu) || []).length, 1);
    assert.match(turn.tutor, /I’m going to give you another piece of information/u);
    assert.match(turn.tutor, /Let’s role-play it: I’ll be the town assayer/u);
    assert.doesNotMatch(turn.tutor, /Edony|p_holder|R1_blank|meltedAt\(/u);
    assert.equal(turn.tutorResponseRepaired, false);
    assert.equal(turn.tutorDeterministicFallback, false);
    assert.equal(turn.tutorLeakAudit.ok, true);
    assert.equal(turn.prompts.tutor.promptAudit.ok, true);
    assert.equal(turn.prompts.tutor.speakerPrivilegeAudit.ok, true);
    assert.equal(turn.tutorGuardAccounting.finalDelivery.source, 'original_candidate');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('automated-learner prompt produces the selected behavior without exposing measurement targets', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-prompt-behavior-'));
  try {
    const savePath = path.join(tmp, 'learner-transcript.json');
    const { result, promptLog } = runTutorStub({
      tmp,
      args: [
        ...commonArgs(tmp, path.basename(savePath)),
        '--auto-learner',
        '--auto-turns',
        '1',
        '--auto-learner-profile',
        'proof_skipper',
      ],
    });
    const transcript = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    const turn = transcript.turns[0];
    const requests = readPromptLog(promptLog);
    const learnerRequest = requests.find((request) => request.role === 'learner');

    assert.ok(learnerRequest, 'expected one automated-learner model request');
    assert.match(learnerRequest.input, /private behavior brief/u);
    assert.match(learnerRequest.input, /Recurring behavior: omits the warrant between clue and conclusion/u);
    assert.doesNotMatch(
      learnerRequest.input,
      /proof_skipper|Target recurrence|Behavioral signature|Score bands|Coverage velocity|Minimum markers|Must first appear/iu,
    );
    assert.equal(turn.learner, PROOF_SKIPPER_RESPONSE);
    assert.match(turn.learner, /Verrell struck the shillings/u);
    assert.doesNotMatch(turn.learner, /\b(?:because|therefore|since|if|then)\b/iu);
    assert.match(result.stdout, /A Proof-Skipping Learner \(auto\)/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
