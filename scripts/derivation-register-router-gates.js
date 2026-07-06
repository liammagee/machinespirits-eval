#!/usr/bin/env node
/**
 * Register-router gates (classifier-dag-register Phase B) — zero-paid,
 * mock client, world-005-marrick. The pure rule is unit-tested in
 * tests/registerRouter.test.js; these gates prove the PLUMBING:
 *
 *   R1  off-by-default: no flag → no registerRouter result field, no
 *       register_shift events
 *   R2  on-but-quiet: router on (no mocks) over a mock dialogue → decisions
 *       logged every tutor turn, all didactic, and the run's fingerprint is
 *       BYTE-IDENTICAL to the plain run (prompt-side no-op when no rule fires)
 *   R3  confront path: mockLabel mirror + mockDagState → confront register
 *       decided, block present in the tutor prompt, register_shift events
 *   R4  repair path: mockLabel <non-goal node key> + mockDagState → repair
 *       register decided with the block rendered
 *   R5  decision log carries the audit trail (sensedLabel vs label, DAG
 *       state, register) for every tutor turn
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runDrama,
  loadWorld,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
} from '../services/dramaticDerivation/index.js';
import { buildLemmaDag } from '../services/dramaticDerivation/lemmaLayer.js';
import { buildChainMap } from '../services/dramaticDerivation/messageClassifier.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml');
const SCRIPT_PATH = path.join(ROOT, 'config/drama-derivation/tutor-scripts/marrick-v001.md');

const rows = [];
function check(id, ok, detail) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

function cast(world, script, client) {
  return {
    director: makeLlmDirector(world, client, {}),
    tutor: makeLlmTutor(world, client, {
      script,
      didacticMode: true,
      publicRegister: 'modern',
      releaseAuthority: true,
      pacingGuard: true,
    }),
    learner: makeLlmLearner({ setting: world.setting, voice: 'plain', client, publicRegister: 'modern' }),
  };
}

const base = { sceneMode: true, publicRegister: 'modern', stopOnStall: false };
const fingerprint = (r) => JSON.stringify({ ledger: r.ledger, trajectory: r.trajectory, verdict: r.verdict });

async function run(world, script, { options = {}, captureClient = null } = {}) {
  const client = captureClient || makeLlmClient({ mode: 'mock' });
  return runDrama({ world, roles: cast(world, script, client), options: { ...base, ...options } });
}

async function main() {
  const world = loadWorld(WORLD_PATH);
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const dag = buildLemmaDag(world);
  const chainOf = buildChainMap(dag);
  const nonGoalKey = dag.nodes.find((n) => !n.isGoal).key;

  // R1 — off by default
  const plain = await run(world, script);
  check(
    'R1-off-by-default',
    plain.registerRouter === undefined && !(plain.events || []).some((e) => e.type === 'register_shift'),
    'no router field or events without the flag',
  );

  // R2 — on but quiet: decisions logged, all didactic, fingerprint identical
  const quiet = await run(world, script, { options: { registerRouter: true } });
  const qd = quiet.registerRouter?.decisions || [];
  check(
    'R2-quiet-decisions',
    qd.length > 0 && qd.every((d) => d.register === 'didactic') && quiet.registerRouter.shifts === 0,
    `router on, mock dialogue: ${qd.length} decisions, all didactic`,
  );
  check(
    'R2-quiet-fingerprint',
    fingerprint(quiet) === fingerprint(plain),
    'no-fire router run is byte-identical to the plain run',
  );

  // R3 — confront path (mock sensor + mock DAG state), block in prompt
  const inner = makeLlmClient({ mode: 'mock' });
  const tutorPrompts = [];
  const spy = {
    ...inner,
    call: (role, callArgs) => {
      if (role === 'tutor') tutorPrompts.push(callArgs.user || '');
      return inner.call(role, callArgs);
    },
  };
  const confront = await run(world, script, {
    options: { registerRouter: { mockLabel: 'mirror', mockDagState: true } },
    captureClient: spy,
  });
  const cd = confront.registerRouter?.decisions || [];
  check(
    'R3-confront-decided',
    cd.length > 0 && cd.every((d) => d.register === 'confront') && confront.registerRouter.shifts === cd.length,
    `confront decided on every tutor turn (${cd.length})`,
  );
  check(
    'R3-confront-rendered',
    tutorPrompts.length > 0 && tutorPrompts.every((p) => p.includes('CONFRONT REGISTER')),
    'confront block present in every tutor prompt',
  );
  check(
    'R3-confront-events',
    (confront.events || []).filter((e) => e.type === 'register_shift').length > 0,
    'register_shift events recorded',
  );

  // R4 — repair path
  const repair = await run(world, script, {
    options: { registerRouter: { mockLabel: nonGoalKey, mockDagState: true } },
  });
  const rd = repair.registerRouter?.decisions || [];
  check(
    'R4-repair-decided',
    rd.length > 0 && rd.every((d) => d.register === 'repair'),
    `repair decided on every tutor turn (${rd.length}, chain ${chainOf.get(nonGoalKey)})`,
  );

  // R5 — audit trail
  check(
    'R5-audit-trail',
    cd.every(
      (d) =>
        typeof d.turn === 'number' &&
        typeof d.sensedLabel === 'string' &&
        d.label === 'mirror' &&
        typeof d.partnerDerivable === 'boolean' &&
        Array.isArray(d.regressedChains),
    ),
    'every decision logs turn, sensed vs applied label, and DAG state',
  );

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} register-router gates pass`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
