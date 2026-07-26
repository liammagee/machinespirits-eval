import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubProofDagArtifactPaths,
  projectTutorStubProofDagSemanticLayerLines,
} from '../services/tutorStubProofCommandPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  bold: '<bold>',
  brightBlue: '<bright-blue>',
  brightCyan: '<bright-cyan>',
  brightMagenta: '<bright-magenta>',
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

function semanticFixture() {
  return {
    validation: {
      graphs: {
        authored: { quadCount: 118, conforms: true },
        learner: { quadCount: 93, conforms: true },
        tutor: { quadCount: 54, conforms: false },
      },
    },
    world: {
      premises: [{}, {}, {}, {}, {}, {}, {}],
      rules: [{}, {}, {}, {}],
      proofPaths: [{}, {}],
    },
    projections: {
      learnerProxyDag: {
        turn: 26,
        metrics: { groundedCount: 6, voicedDerivedCount: 3, hypothesisCount: 1, answerCandidateCount: 0 },
      },
      tutorLearnerDagModel: {
        turn: 26,
        assessment: { bestPathCoverage: 0.857, bottleneck: 'learner_integration_gap', missingPremiseCount: 1 },
      },
    },
  };
}

test('proof-DAG artifact projection pins every path, exact bytes, and trailing blank line', () => {
  const projection = projectTutorStubProofDagArtifactPaths({ colors: COLORS });
  const output = terminalBytes(projection.lines);

  assert.equal(projection.rows.length, 7);
  assert.deepEqual(projection.rows[0], ['operator guide', 'docs/proof-dag-verification-and-inspection.md']);
  assert.deepEqual(projection.rows.at(-1), [
    'SHACL report',
    'tools/proof-dag-semantic-web/Generated/World001Nocturne/validation-report.json',
  ]);
  assert.equal(sha256(output), 'd57f60ce247cb528126ca741f9f547c1b2ddbff00f80d8a677604f82b0b63f6d');
  assert.match(output, /public-only<reset>\n\n$/u);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.lines), true);
});

test('authored semantic-layer projection pins private authority counts and exact bytes', () => {
  const result = semanticFixture();
  const before = structuredClone(result);
  const lines = projectTutorStubProofDagSemanticLayerLines({ result, layer: 'authored', colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '057a74e207497723b888abe0abfe517b2c89e158a6be8f006ea887d22863fc46');
  assert.match(output, /118 quads · SHACL conforms · 7 premises · 4 rules · 2 positive proof paths/u);
  assert.match(output, /contains the secret and authored identifiers/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(result, before, 'authored projection must not mutate its input');
});

test('learner semantic-layer projection pins public metrics and exact bytes', () => {
  const result = semanticFixture();
  const before = structuredClone(result);
  const lines = projectTutorStubProofDagSemanticLayerLines({ result, layer: 'learner', colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '140b455007d7737fbb2dbf8159af2bbc9fe8516054cbffd4898b2c48126b9815');
  assert.match(output, /public-only proxy graph at fixture turn 26/u);
  assert.match(output, /93 quads · SHACL conforms · 6 grounded · 3 voiced · 1 hypotheses · 0 answers/u);
  assert.match(output, /source redaction audit passed/u);
  assert.deepEqual(result, before, 'learner projection must not mutate its input');
});

test('tutor semantic-layer projection pins advisory metrics, failure state, and exact bytes', () => {
  const result = semanticFixture();
  const before = structuredClone(result);
  const lines = projectTutorStubProofDagSemanticLayerLines({ result, layer: 'tutor', colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '0951ededb8769a18e4df9f4348da32156d2d9b151aafa9f0cba59de91f083eee');
  assert.match(output, /public-only advisory model at fixture turn 26/u);
  assert.match(
    output,
    /54 quads · SHACL fails · best-path coverage 0\.857 · bottleneck learner_integration_gap · 1 missing premises/u,
  );
  assert.match(output, /source redaction audit passed/u);
  assert.deepEqual(result, before, 'tutor projection must not mutate its input');
});

test('real /proof paths and learner inspection commands preserve exact no-model terminal blocks', () => {
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
      '--dag',
      '--tutor-learner-dag',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/proof paths\n/proof inspect learner\n/quit\n',
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    },
  );
  const paths = result.stdout.match(/proof-DAG artifacts >[\s\S]*?\n\n/u)?.[0] || '';
  const inspect = result.stdout.match(/proof DAG > inspect[\s\S]*?\n\n/u)?.[0] || '';

  assert.equal(result.status, 0, result.stderr);
  assert.equal(Buffer.byteLength(paths), 744);
  assert.equal(sha256(paths), '049be5a1ab7288cb83f35c2e9f2ffc22a1614166e56ca8cb7f4fcd62eca73f45');
  assert.equal(Buffer.byteLength(inspect), 682);
  assert.equal(sha256(inspect), '646d1d08c5d23914ba483196d738e7bcc2bc14238d283a910d6300679ac012c9');
});

test('the CLI retains command execution, formal checks, trace writes, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubProofCommandPresentation.js'), 'utf8');
  const proofSlice = cliSource.slice(
    cliSource.indexOf('function printProofDagArtifactPaths'),
    cliSource.indexOf('function handleDirectorGuidanceCommand'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubProofCommandPresentation\.js';/u);
  assert.match(proofSlice, /projectTutorStubProofDagArtifactPaths/u);
  assert.match(proofSlice, /projectTutorStubProofDagSemanticLayerLines/u);
  assert.match(proofSlice, /console\.log\(line\)/u);
  assert.match(proofSlice, /spawnSync\(process\.execPath/u);
  assert.match(proofSlice, /export-proof-dag-semantic-web\.js/u);
  assert.match(proofSlice, /appendTraceEvent\(state\.trace/u);
  assert.match(proofSlice, /paths: paths\.map/u);
  assert.doesNotMatch(proofSlice, /private authority graph/u);
  assert.match(serviceSource, /export function projectTutorStubProofDagArtifactPaths/u);
  assert.match(serviceSource, /export function projectTutorStubProofDagSemanticLayerLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
