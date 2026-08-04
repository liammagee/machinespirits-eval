import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubInteractiveHelpLines } from '../services/tutorStubInteractiveHelp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP_ROWS = Object.freeze([
  Object.freeze({
    label: 'scene',
    commands: Object.freeze(['/scenario', '/board']),
    summary: 'change the active inquiry',
  }),
  Object.freeze({
    label: 'inspect',
    commands: Object.freeze(['/analysis', '/proof']),
    summary: 'inspect learning state',
  }),
]);

const COLORS = Object.freeze({
  brightCyan: '<bright-cyan>',
  bold: '<bold>',
  reset: '<reset>',
  dim: '<dim>',
  cyan: '<cyan>',
});

const ALL_AVAILABLE = Object.freeze({
  '/feedback': true,
  '/committee': true,
  '/random': true,
  '/suggest': true,
  '/board': true,
  '/proof': true,
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('normal interactive help projection pins every conditional section and exact terminal bytes', () => {
  const input = {
    mode: 'normal',
    helpRows: HELP_ROWS,
    commandAvailability: ALL_AVAILABLE,
    learningSummaryActive: true,
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubInteractiveHelpLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '69c0bf92138ced073a3ef16dcac38e24ad6f4cbf0c02781f690cfc5014a50db2');
  assert.equal(
    lines[0],
    '<bright-cyan><bold>commands<reset><dim> · type / to browse; keep typing to filter; Tab completes<reset>',
  );
  assert.match(output, /<cyan> {2}scene {7}<reset> \/scenario · \/board — change the active inquiry/u);
  assert.match(output, /Tutor ratings are optional/u);
  assert.match(output, /learned Qwen warrant committee/u);
  assert.match(output, /\/random toggles a session-only performance experiment/u);
  assert.match(output, /\/suggest previews the reply and profile expression/u);
  assert.match(output, /\/board reads workplan\/items live/u);
  assert.match(output, /\/proof checks the deterministic Nocturne certificate fixture/u);
  assert.match(output, /A learner-centred summary is written when the conversation ends\.<reset>\n\n$/u);
  assert.deepEqual(input, before, 'interactive help projection must not mutate its inputs');
});

test('normal interactive help projection preserves unavailable-command omissions and blank close', () => {
  const lines = projectTutorStubInteractiveHelpLines({
    mode: 'normal',
    helpRows: HELP_ROWS,
    commandAvailability: {},
    learningSummaryActive: false,
    colors: COLORS,
  });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), 'fd2c729ee9f395bb508f00e0f684cbf6cb6b46845b4b140576708329b3a9e3b5');
  assert.doesNotMatch(output, /Tutor ratings|Qwen|\/random toggles|\/board reads|\/proof checks/u);
  assert.doesNotMatch(output, /\/suggest previews/u);
  assert.match(output, /\/transcript opens raw, script, swimlane, analysis, prompt, settings, and Replay JS views/u);
  assert.match(output, /<reset>\n\n$/u);
});

test('passthrough interactive help projection preserves compact rows and ignores normal-only conditions', () => {
  const lines = projectTutorStubInteractiveHelpLines({
    mode: 'passthrough',
    helpRows: HELP_ROWS,
    commandAvailability: ALL_AVAILABLE,
    learningSummaryActive: true,
    colors: COLORS,
  });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '1126f06767f2b34774d1cbed09f9d67079e3a263ce9bdff213a420222b849a32');
  assert.equal(lines.length, 5);
  assert.equal(lines[0], '<bright-cyan><bold>passthrough commands<reset>');
  assert.match(output, /<cyan> {2}chat<reset> {7}type any ordinary line/u);
  assert.match(output, /<cyan> {2}scene {6}<reset> \/scenario · \/board — change the active inquiry/u);
  assert.match(output, /No classifier, reasoning tracker, register selection, response check, release planner/u);
  assert.doesNotMatch(output, /Tutor ratings|Qwen|\/random toggles|learner-centred summary/u);
  assert.match(output, /<reset>\n\n$/u);
});

test('the public presentation runtime owns command-registry context and terminal projection', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubInteractiveHelp.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubPublicPresentationRuntime.js'), 'utf8');
  const interactiveHelpSlice = runtimeSource.slice(
    runtimeSource.indexOf('function printInteractiveHelp'),
    runtimeSource.indexOf('function printTutorStubReleaseNotes'),
  );

  assert.match(cliSource, /createTutorStubPublicPresentationRuntime/u);
  assert.match(runtimeSource, /from '\.\/tutorStubInteractiveHelp\.js';/u);
  assert.match(interactiveHelpSlice, /tutorStubCommandAvailable/u);
  assert.match(interactiveHelpSlice, /tutorStubCommandHelpRows/u);
  assert.match(interactiveHelpSlice, /projectTutorStubInteractiveHelpLines/u);
  assert.match(interactiveHelpSlice, /writeLine\(line\)/u);
  assert.doesNotMatch(interactiveHelpSlice, /Tutor ratings are optional/u);
  assert.match(serviceSource, /export function projectTutorStubInteractiveHelpLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|setInterval|clearInterval|Date\.now)\s*[.(]/u);
});
