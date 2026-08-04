import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubDagSnapshot,
  projectTutorStubDagSnapshotLines,
} from '../services/tutorStubDagSnapshotPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({ cyan: '<cyan>', dim: '<dim>', reset: '<reset>' });

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('missing tutor-DAG snapshots project no terminal lines', () => {
  assert.deepEqual(projectTutorStubDagSnapshotLines(), []);
  assert.deepEqual(projectTutorStubDagSnapshotLines({ snapshot: null, colors: COLORS }), []);
  assert.equal(Object.isFrozen(projectTutorStubDagSnapshotLines()), true);
});

test('tutor-DAG snapshot projection preserves nodes, edges, releases, and unknown references', () => {
  const pSeen = { fact: ['observed', 'mark'] };
  const world = {
    releaseSchedule: [
      { premise: 'p_seen', turn: 2, via: 'tutor' },
      { premise: 'p_next', turn: 7, via: 'director' },
    ],
    premiseById: new Map([['p_seen', pSeen]]),
  };
  const dag = {
    schema: 'fixture.dag.v1',
    derivable: true,
    root: 'root',
    leaves: ['p_seen', 'p_unknown'],
    nodes: [
      { id: 'seen', leaf: true, premiseId: 'p_seen', origin: 'premise', fact: pSeen.fact },
      { id: 'root', origin: 'rule', rule: 'R1', statement: { content: { rel: 'grounded_L', of: ['answer', 'x'] } } },
    ],
    edges: [
      { from: 'root', to: 'seen', rule: 'R1' },
      { from: 'missing', to: 'root' },
    ],
  };

  const snapshot = projectTutorStubDagSnapshot({
    dag,
    world,
    tutorTurn: 5,
    releasedRows: [{ premise: 'p_seen', turn: 3 }],
    nextRelease: { premise: 'p_next', turn: 7, via: 'director', surface: 'private' },
  });

  assert.equal(snapshot.schema, 'fixture.dag.v1');
  assert.equal(snapshot.rootLabel, 'ground:answer(x)');
  assert.equal(snapshot.leavesReleased, 1);
  assert.equal(snapshot.leavesTotal, 2);
  assert.deepEqual(snapshot.nextRelease, { premise: 'p_next', turn: 7, via: 'director' });
  assert.deepEqual(snapshot.leaves, [
    {
      premise: 'p_seen',
      fact: 'observed(mark)',
      released: true,
      scheduledTurn: 2,
      releasedTurn: 3,
      via: 'tutor',
    },
    {
      premise: 'p_unknown',
      fact: 'p_unknown',
      released: false,
      scheduledTurn: null,
      releasedTurn: null,
      via: null,
    },
  ]);
  assert.equal(snapshot.nodes[0].label, 'hold:p_seen');
  assert.equal(snapshot.nodes[1].fact, 'answer(x)');
  assert.equal(snapshot.edges[0].fromLabel, 'ground:answer(x)');
  assert.equal(snapshot.edges[0].toLabel, 'hold:p_seen');
  assert.equal(snapshot.edges[1].fromLabel, 'unknown');
});

test('tutor-DAG snapshot projection preserves missing-input and no-next-release branches', () => {
  assert.equal(projectTutorStubDagSnapshot(), null);
  assert.equal(projectTutorStubDagSnapshot({ dag: {}, world: null }), null);
  const snapshot = projectTutorStubDagSnapshot({
    dag: { schema: 'fixture', derivable: false, root: 'missing' },
    world: { releaseSchedule: [], premiseById: new Map() },
    tutorTurn: 1,
  });
  assert.equal(snapshot.rootLabel, 'unknown');
  assert.equal(snapshot.nextRelease, null);
  assert.deepEqual(snapshot.leaves, []);
});

test('non-derivable tutor-DAG projection pins exact bytes and its trailing blank line', () => {
  const input = {
    snapshot: Object.freeze({
      turn: 3,
      derivable: false,
      leavesReleased: 1,
      leavesTotal: 2,
    }),
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubDagSnapshotLines(input);
  const output = terminalBytes(lines);

  assert.deepEqual(lines, [
    '<cyan>tutor DAG ><reset> turn 3: 1/2 proof leaves released',
    "<dim>  not derivable from this world's authored proof data<reset>\n",
  ]);
  assert.equal(sha256(output), '76caa1ffc74a12329d416f3a433f697f690f6d652c54cd3c2c4446f77dc1aed4');
  assert.match(output, /authored proof data<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before, 'non-derivable projection must not mutate its inputs');
});

test('derivable tutor-DAG projection pins exact edge, leaf, schedule, and release bytes', () => {
  const input = {
    snapshot: Object.freeze({
      turn: 5,
      derivable: true,
      rootLabel: 'ground:answer(case, learner)',
      leavesReleased: 1,
      leavesTotal: 3,
      nextRelease: Object.freeze({ premise: 'p_next', turn: 7, via: 'director' }),
      edges: Object.freeze([
        Object.freeze({ fromLabel: 'ground:step', toLabel: 'hold:p_seen', rule: 'R_seen' }),
        Object.freeze({ fromLabel: 'ground:answer', toLabel: 'ground:step', rule: null }),
      ]),
      leaves: Object.freeze([
        Object.freeze({
          premise: 'p_seen',
          fact: 'observed(mark)',
          released: true,
          scheduledTurn: 2,
          via: 'tutor',
        }),
        Object.freeze({
          premise: 'p_next',
          fact: 'holds(tool)',
          released: false,
          scheduledTurn: 7,
          via: 'director',
        }),
        Object.freeze({
          premise: 'p_unscheduled',
          fact: 'matches(residue)',
          released: false,
          scheduledTurn: null,
          via: null,
        }),
      ]),
    }),
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubDagSnapshotLines(input);
  const output = terminalBytes(lines);

  assert.deepEqual(lines, [
    '<cyan>tutor DAG ><reset> turn 5: 1/3 proof leaves released',
    '<dim>  root: ground:answer(case, learner)<reset>',
    '<dim>  next release: p_next at turn 7 via director<reset>',
    '<dim>  edges:<reset>',
    '<dim>    ground:step -> hold:p_seen (R_seen)<reset>',
    '<dim>    ground:answer -> ground:step<reset>',
    '<dim>  leaves:<reset>',
    '<dim>    [x] p_seen t2/tutor: observed(mark)<reset>',
    '<dim>    [ ] p_next t7/director: holds(tool)<reset>',
    '<dim>    [ ] p_unscheduled unscheduled: matches(residue)<reset>',
    '',
  ]);
  assert.equal(sha256(output), '6940e3b64987ff24aa5f4263200484787683ba234d35efd679f1bc498831b1ed');
  assert.match(output, /p_unscheduled unscheduled: matches\(residue\)<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before, 'derivable projection must not mutate its inputs');
});

test('derivable tutor-DAG projection preserves the no-next-release branch', () => {
  const lines = projectTutorStubDagSnapshotLines({
    snapshot: {
      turn: 8,
      derivable: true,
      rootLabel: 'root',
      leavesReleased: 0,
      leavesTotal: 0,
      nextRelease: null,
      edges: [],
      leaves: [],
    },
  });

  assert.deepEqual(lines, [
    'tutor DAG > turn 8: 0/0 proof leaves released',
    '  root: root',
    '  next release: none',
    '  edges:',
    '  leaves:',
    '',
  ]);
});

test('a live technical session preserves the exact Marrick tutor-DAG terminal block', { timeout: 20_000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-dag-snapshot-presentation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--release-speed',
        '2',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on technical\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('tutor DAG >'),
      timeoutMs: 15_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });
    const dagBlock = result.plain.match(/tutor DAG >[\s\S]*?\n\n(?=codex\/)/u)?.[0] || '';

    assert.equal(Buffer.byteLength(dagBlock), 1388, JSON.stringify(dagBlock));
    assert.equal(sha256(dagBlock), 'bee3c9b0fe3fb71757b64101df39a785b8f13bfd986c2ce8ec017fcbe2347ebd');
    assert.match(dagBlock, /^tutor DAG > turn 1: 0\/6 proof leaves released\n/u);
    assert.match(dagBlock, /\[ \] p_holder t20\/director: soleHolderOf\(wornBurin, edony\)\n\n$/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the CLI retains snapshot state access, terminal writes, and every runtime caller', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubDagSnapshotPresentation.js'), 'utf8');
  const technicalAnalysisSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubTechnicalAnalysisPresentation.js'),
    'utf8',
  );
  const turnOrchestrationSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTurnOrchestration.js'), 'utf8');
  const snapshotSlice = cliSource.slice(
    cliSource.indexOf('function buildTutorDagSnapshot'),
    cliSource.indexOf('function oneLine'),
  );

  assert.match(cliSource, /projectTutorStubDagSnapshot,/u);
  assert.match(snapshotSlice, /function buildTutorDagSnapshot\(state, tutorTurn\)/u);
  assert.match(snapshotSlice, /committedReleaseRows\(state, tutorTurn\)/u);
  assert.match(snapshotSlice, /nextReleaseRow\(state\)/u);
  assert.match(snapshotSlice, /projectTutorStubDagSnapshot\(/u);
  assert.match(snapshotSlice, /projectTutorStubDagSnapshotLines/u);
  assert.match(snapshotSlice, /console\.log\(line\)/u);
  assert.doesNotMatch(snapshotSlice, /proof leaves released/u);
  const runtimeCallerCount =
    (cliSource.match(/printTutorDagSnapshot\(/gu)?.length || 0) +
    (turnOrchestrationSource.match(/printTutorDagSnapshot\(/gu)?.length || 0);
  assert.equal(runtimeCallerCount, 4);
  assert.match(turnOrchestrationSource, /printTutorDagSnapshot\(response\.dagSnapshot\)/u);
  assert.match(
    technicalAnalysisSource,
    /import \{ projectTutorStubDagSnapshotLines \} from '\.\/tutorStubDagSnapshotPresentation\.js';/u,
  );
  assert.match(serviceSource, /export function projectTutorStubDagSnapshotLines/u);
  assert.match(serviceSource, /export function projectTutorStubDagSnapshot/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
