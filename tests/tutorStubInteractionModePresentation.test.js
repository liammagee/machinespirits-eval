import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubInteractionModeBannerLines,
  projectTutorStubInteractionModeLabel,
} from '../services/tutorStubInteractionModePresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  bold: '<bold>',
  brightBlue: '<bright-blue>',
  brightGreen: '<bright-green>',
  brightYellow: '<bright-yellow>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('interaction-mode label projection pins learner, mixed, coach, and auto colors', () => {
  assert.equal(
    projectTutorStubInteractionModeLabel({ mode: 'learner', colors: COLORS }),
    '<bright-green><bold>LEARNER<reset>',
  );
  assert.equal(
    projectTutorStubInteractionModeLabel({ mode: 'learner', mixedEnabled: true, colors: COLORS }),
    '<bright-green><bold>MIXED<reset>',
  );
  assert.equal(
    projectTutorStubInteractionModeLabel({ mode: 'coach', mixedEnabled: true, colors: COLORS }),
    '<bright-yellow><bold>COACH<reset>',
  );
  assert.equal(
    projectTutorStubInteractionModeLabel({ mode: 'auto', mixedEnabled: true, colors: COLORS }),
    '<bright-blue><bold>AUTO<reset>',
  );
});

test('learner banner projection pins exact detail bytes and input immutability', () => {
  const options = { mode: 'learner', mixedEnabled: false, detail: true, colors: { ...COLORS } };
  const before = structuredClone(options);
  const lines = projectTutorStubInteractionModeBannerLines(options);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '4e24f5e1e1c693657bb69b50dec05bb85eca41afa6c63071417623c2c5d634f2');
  assert.match(output, /LEARNER<reset> <dim>mode · your lines become public learner speech/u);
  assert.match(output, /switch with \/coach or hand off with \/auto \[turns\]<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(options, before, 'learner banner projection must not mutate its input');
});

test('mixed banner projection pins its label, affordances, and learner detail line', () => {
  const output = terminalBytes(
    projectTutorStubInteractionModeBannerLines({
      mode: 'learner',
      mixedEnabled: true,
      colors: COLORS,
    }),
  );

  assert.equal(sha256(output), 'f00306f9aeea644dfb79ea932862465cd1994e8ee22e7be46e7d1ed4101b1c94');
  assert.match(output, /MIXED<reset> <dim>mode · .*AI drafts, clues, and \/use are available/u);
  assert.match(output, /switch with \/coach or hand off with \/auto \[turns\]/u);
});

test('coach banner projection pins private-guidance copy and trailing blank line', () => {
  const output = terminalBytes(
    projectTutorStubInteractionModeBannerLines({ mode: 'coach', mixedEnabled: true, colors: COLORS }),
  );

  assert.equal(sha256(output), '490761cc2aa77cebac26dad1faeba611e444ae55e6ba92a449cc6e645a5b5e82');
  assert.match(output, /COACH<reset> <dim>mode · your lines are private suggestions/u);
  assert.match(output, /guidance stays out of the public transcript;.*\/use in mixed mode<reset>\n\n$/u);
});

test('auto and compact banner projections retain their single-line branches', () => {
  const autoLines = projectTutorStubInteractionModeBannerLines({ mode: 'auto', colors: COLORS });
  const compactLines = projectTutorStubInteractionModeBannerLines({ mode: 'learner', detail: false, colors: COLORS });

  assert.equal(autoLines.length, 1);
  assert.equal(sha256(terminalBytes(autoLines)), '0efc11665698057772681fc74280d9b71abb29bb2432922fc058186b235f072e');
  assert.match(autoLines[0], /AUTO<reset> <dim>mode · the automated learner and tutor now play without intervention/u);
  assert.equal(compactLines.length, 1);
  assert.equal(sha256(terminalBytes(compactLines)), 'cb00b518d8e1bf6e5a21bdd4ce4b2bf71b367439043e39c56078107b80f809f6');
});

test('real startup and mode-switch commands preserve exact no-model terminal blocks', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--no-remember-settings',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/mode coach\n/mode learner\n/quit\n',
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    },
  );
  const startup = result.stdout.match(/╭─ LEARNER mode · your lines become public learner speech\n/u)?.[0] || '';
  const coach = result.stdout.match(/╭─ COACH mode ·[\s\S]*?mixed mode\n\n/u)?.[0] || '';
  const learner =
    result.stdout.match(
      /╭─ LEARNER mode · your lines become public learner speech\n╰─ switch with \/coach or hand off with \/auto \[turns\]\n\n/u,
    )?.[0] || '';

  assert.equal(result.status, 0, result.stderr);
  assert.equal(Buffer.byteLength(startup), 63);
  assert.equal(sha256(startup), '771bbcceab4d54f6fb259ff060aca848b688de72cdc340d2268973fd3e74bd58');
  assert.equal(Buffer.byteLength(coach), 190);
  assert.equal(sha256(coach), '0a5d427ded7beaa5b92f0f470c61c018a940b6dcc567b77a88f577e58c4ef7af');
  assert.equal(Buffer.byteLength(learner), 121);
  assert.equal(sha256(learner), 'b7a7758ff80a94fdfdef2cc529dc75bc84c9f7e27e0d99ac2fdb1a5f406f97b1');
});

test('the CLI retains interaction state, prompt, trace, automation, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubInteractionModePresentation.js'), 'utf8');
  const modeSlice = cliSource.slice(
    cliSource.indexOf('function interactionModeLabel'),
    cliSource.indexOf('function printInteractiveStatus'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubInteractionModePresentation\.js';/u);
  assert.match(modeSlice, /state\.interaction\?\.mode/u);
  assert.match(modeSlice, /mixedLearner\.enabled/u);
  assert.match(modeSlice, /projectTutorStubInteractionModeLabel/u);
  assert.match(modeSlice, /projectTutorStubInteractionModeBannerLines/u);
  assert.match(modeSlice, /console\.log\(line\)/u);
  assert.match(modeSlice, /state\.interaction\.mode = normalized/u);
  assert.match(modeSlice, /rl\.setPrompt\(mixedLearnerPromptText\(\)\)/u);
  assert.match(modeSlice, /type: 'interactive_mode_changed'/u);
  assert.doesNotMatch(modeSlice, /your lines are private suggestions/u);
  assert.match(serviceSource, /export function projectTutorStubInteractionModeLabel/u);
  assert.match(serviceSource, /export function projectTutorStubInteractionModeBannerLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
