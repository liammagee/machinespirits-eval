import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubFeatureMapLines } from '../services/tutorStubFeatureMap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FEATURE_ROWS = Object.freeze([
  Object.freeze({ label: 'participate', description: 'human learner · private coach' }),
  Object.freeze({ label: 'teach', description: 'open topics · proof-DAG scenarios' }),
]);

const COLORS = Object.freeze({
  brightCyan: '<bright-cyan>',
  brightGreen: '<bright-green>',
  bold: '<bold>',
  cyan: '<cyan>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('launch feature-map projection pins capability rows, quick starts, and terminal bytes', () => {
  const input = { featureRows: FEATURE_ROWS, colors: COLORS };
  const before = structuredClone(input);
  const lines = projectTutorStubFeatureMapLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), 'dd43ebe2338acaa1d8eab304d4d3006d901c222c9274b34f6ebe9d15ba1e6b02');
  assert.equal(lines.length, 13);
  assert.equal(lines[0], '<bright-cyan><bold>tutor-stub capability map<reset>');
  assert.match(output, /<cyan> {2}participate<reset> human learner · private coach/u);
  assert.match(output, /<cyan> {2}teach {6}<reset> open topics · proof-DAG scenarios/u);
  assert.match(output, /npm run tutor:stub:workplan -- --module <id>/u);
  assert.match(output, /npm run tutor:stub:qa -- --suite core --runs 1 --dry-run/u);
  assert.doesNotMatch(output, /active now >/u);
  assert.match(output, /<reset>\n\n$/u);
  assert.deepEqual(input, before, 'feature-map projection must not mutate its inputs');
});

test('session feature-map projection pins active context without owning state resolution', () => {
  const input = {
    featureRows: FEATURE_ROWS,
    activeContext: Object.freeze({
      mode: 'learner',
      content: 'scenario: The Light Shillings',
      mechanisms: Object.freeze(['learner and coach roles', 'adaptive delivery']),
    }),
    colors: COLORS,
  };
  const before = structuredClone(input);
  const output = terminalBytes(projectTutorStubFeatureMapLines(input));

  assert.equal(sha256(output), '07efa5463f13c1a68fd0fb2bb20406270875aa27855d0752024f8f326dd9b047');
  assert.match(
    output,
    /<bright-green><bold>active now ><reset> learner · scenario: The Light Shillings · learner and coach roles · adaptive delivery/u,
  );
  assert.match(output, /<reset>\n\n$/u);
  assert.deepEqual(input, before, 'session projection must not mutate its inputs');
});

test('the public presentation runtime owns capability context and terminal projection', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubFeatureMap.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubPublicPresentationRuntime.js'), 'utf8');
  const featureMapSlice = runtimeSource.slice(
    runtimeSource.indexOf('function printTutorStubFeatureMap'),
    runtimeSource.indexOf('function printInteractiveHelp'),
  );

  assert.match(cliSource, /createTutorStubPublicPresentationRuntime/u);
  assert.match(runtimeSource, /from '\.\/tutorStubFeatureMap\.js';/u);
  assert.match(featureMapSlice, /tutorStubCapabilityFeatureRows/u);
  assert.match(featureMapSlice, /state\.curriculum/u);
  assert.match(featureMapSlice, /state\.capabilities\.capabilities/u);
  assert.match(featureMapSlice, /projectTutorStubFeatureMapLines/u);
  assert.match(featureMapSlice, /writeLine\(line\)/u);
  assert.doesNotMatch(featureMapSlice, /quick starts/u);
  assert.match(serviceSource, /export function projectTutorStubFeatureMapLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|setInterval|clearInterval|Date\.now)\s*[.(]/u);
});
