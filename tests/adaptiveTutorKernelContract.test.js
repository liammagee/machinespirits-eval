// GUARD: one adaptive tutoring kernel, and every surface allowed to differ
// says so. The contract these tests hold is ADAPTIVE-TUTOR-KERNEL-CONTRACT.md.
//
// Adaptive policy is written in several places in this repo. The kernel in
// services/adaptiveTutor/ is the canonical state -> action -> guard ->
// realization -> outcome-closure loop; the derivation and tutor-stub surfaces
// run their own policy on purpose. Nothing structural stopped a new surface
// from forking action selection, the guard, or outcome observation without an
// argument. These tests are that stop.
//
// Offline and free: no provider, no store, no run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTATION_ACTIONS,
  ADAPTATION_ACTION_REGISTRY_VERSION,
  ADAPTATION_POLICY_LAYER_VERSION,
} from '../services/adaptiveTutor/actionPolicy.js';
import { INTERVENTION_LEDGER_VERSION } from '../services/adaptiveTutor/interventionLedger.js';
import { OUTCOME_OBSERVER_VERSION } from '../services/adaptiveTutor/outcomeObserver.js';
import { SUPPORTED_ARCHITECTURES } from '../services/adaptiveTutor/graph.js';
import {
  TUTOR_STUB_MOVE_FAMILIES,
  supportLevelForAction,
  tutorStubMoveFamilyForAction,
} from '../services/adaptiveTutor/tutorStubActionAdapter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_DOC = path.join(REPO_ROOT, 'ADAPTIVE-TUTOR-KERNEL-CONTRACT.md');

// One node per stage of the contract, in the order a turn runs them.
const CLOSED_LOOP_STAGES = [
  'close_previous_intervention',
  'realize_staged_followup',
  'estimate_learner_state',
  'select_pedagogical_action',
  'validate_adaptation_contract',
  'realize_tutor_utterance',
  'verify_realization',
  'persist_pending_intervention',
];

// Every surface OUTSIDE services/adaptiveTutor/ that reaches the kernel's
// policy, ledger, or observation. Modules inside that directory are the kernel
// and import each other by relative path, so they do not appear here.
//
// A new entry is a design decision — it belongs in the surface map of
// ADAPTIVE-TUTOR-KERNEL-CONTRACT.md as well as in this list.
const DECLARED_KERNEL_CALLERS = [
  // Adapters: they call the kernel and add only lowering or transport.
  'services/blueprintActionContracts.js',
  'services/learnerTutorInteractionEngine.js',
  'services/tutorStubTypedActionPlanningRuntime.js',
  'services/tutorStubTypedActionRestoration.js',
  // Offline analysis over kernel functions; no policy of their own.
  'scripts/analyze-adaptation-outcome-closure.js',
  'scripts/evaluate-adaptation-policy.js',
  'scripts/run-character-dag-drama-framework.js',
  'scripts/run-dag-resistance-comparison.js',
];

function grepFiles(pattern) {
  try {
    const out = execFileSync('git', ['grep', '-l', '-E', pattern, '--', 'services', 'scripts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch (error) {
    if (error.status === 1) return []; // git grep exits 1 on no match
    throw error;
  }
}

test('the closed loop declares one node per stage of the contract, in order', () => {
  assert.ok(
    SUPPORTED_ARCHITECTURES.includes('state_policy_closed_loop'),
    'the canonical kernel architecture must stay registered',
  );

  const source = fs.readFileSync(path.join(REPO_ROOT, 'services/adaptiveTutor/graph.js'), 'utf8');
  const start = source.indexOf("if (architecture === 'state_policy_closed_loop')");
  assert.ok(start > 0, 'the closed-loop architecture must have its own graph block');
  const block = source.slice(start, source.indexOf('\n  }\n', start));

  const declared = [...block.matchAll(/\.addNode\('([a-z_]+)'/gu)].map((match) => match[1]);
  for (const stage of CLOSED_LOOP_STAGES) {
    assert.ok(declared.includes(stage), `the closed loop must declare a '${stage}' node`);
  }

  // Order is part of the contract: observation and ledger close before a new
  // state is estimated, and the guard sits between selection and realization.
  const at = (stage) => declared.indexOf(stage);
  assert.ok(at('close_previous_intervention') < at('estimate_learner_state'), 'close the last turn before restating');
  assert.ok(at('estimate_learner_state') < at('select_pedagogical_action'), 'state precedes action');
  assert.ok(at('select_pedagogical_action') < at('validate_adaptation_contract'), 'action precedes the guard');
  assert.ok(at('validate_adaptation_contract') < at('realize_tutor_utterance'), 'the guard precedes realization');
  assert.ok(at('realize_tutor_utterance') < at('verify_realization'), 'realization precedes its check');
  assert.ok(at('verify_realization') < at('persist_pending_intervention'), 'the check precedes the ledger write');
});

test('the tutor-stub adapter projects the action registry rather than forking it', () => {
  assert.ok(ADAPTATION_ACTIONS.length > 0, 'the action registry must not be empty');

  const unmappedFamily = [];
  const unmappedSupport = [];
  for (const { action_type: actionType } of ADAPTATION_ACTIONS) {
    const family = tutorStubMoveFamilyForAction(actionType);
    if (!family) unmappedFamily.push(actionType);
    else assert.ok(TUTOR_STUB_MOVE_FAMILIES.includes(family), `${actionType} maps to unknown family '${family}'`);

    // supportLevelForAction throws for an action with no default, which is the
    // failure a new registry entry would otherwise hit only at run time.
    try {
      supportLevelForAction(actionType);
    } catch {
      unmappedSupport.push(actionType);
    }
  }

  assert.deepEqual(unmappedFamily, [], 'these kernel actions have no tutor-stub move family');
  assert.deepEqual(unmappedSupport, [], 'these kernel actions have no tutor-stub default support level');
});

test('the kernel version stamps are pinned, so a semantics change is a visible edit', () => {
  assert.equal(ADAPTATION_ACTION_REGISTRY_VERSION, 'adaptation-action-registry.v1.3');
  assert.equal(ADAPTATION_POLICY_LAYER_VERSION, 'adaptation-policy-layer.v1.0');
  assert.equal(INTERVENTION_LEDGER_VERSION, 'adaptation-intervention-ledger.v1.1');
  assert.equal(OUTCOME_OBSERVER_VERSION, 'adaptation-outcome-observer.v1.3');
});

test('only the declared surfaces reach the kernel policy, ledger, or observer', () => {
  const callers = grepFiles('adaptiveTutor/(actionPolicy|interventionLedger|outcomeObserver)\\.js').sort();

  const undeclared = callers.filter((file) => !DECLARED_KERNEL_CALLERS.includes(file));
  assert.deepEqual(
    undeclared,
    [],
    'a new surface reaches the kernel: add it to DECLARED_KERNEL_CALLERS and to the surface map in ' +
      'ADAPTIVE-TUTOR-KERNEL-CONTRACT.md, or route it through an existing adapter',
  );

  const gone = DECLARED_KERNEL_CALLERS.filter((file) => !callers.includes(file));
  assert.deepEqual(gone, [], 'these declared kernel callers no longer import it; drop them from the contract');
});

test('the one partial adapter still declares its two exclusions', () => {
  // blueprintActionContracts runs the cycle with the ownership gate disabled
  // and realization repair withheld, on purpose. Silently adopting either — or
  // silently widening the exclusion — would change what a blueprint contract
  // means without an argument.
  const source = fs.readFileSync(path.join(REPO_ROOT, 'services/blueprintActionContracts.js'), 'utf8');
  assert.match(source, /validateProofReleaseOwnershipGate is NOT ported/u);
  assert.match(source, /repairRealization is NOT applied/u);
  assert.doesNotMatch(
    source,
    /import\s*\{[^}]*validateProofReleaseOwnershipGate/u,
    'the blueprint path declares the ownership gate excluded; importing it makes the header false',
  );
});

test('the contract document names the kernel and the divergent surfaces', () => {
  const doc = fs.readFileSync(CONTRACT_DOC, 'utf8');
  assert.match(doc, /services\/adaptiveTutor\/` is the canonical state/u);
  // The reconciliation the card asks for: the older banner is scoped, not left
  // to read as authority over the kernel.
  const olderPlan = fs.readFileSync(path.join(REPO_ROOT, 'ADAPTIVE-TUTOR-ACTIVE-PLAN.md'), 'utf8');
  assert.match(olderPlan, /ADAPTIVE-TUTOR-KERNEL-CONTRACT\.md/u);
  assert.doesNotMatch(
    olderPlan.split('\n').slice(0, 6).join('\n'),
    /^Status: canonical active plan/mu,
    'the older plan must not reopen an unscoped canonical claim',
  );
});
