import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import {
  TUTOR_STUB_MOVE_FAMILIES,
  adaptPedagogicalActionToTutorStub,
  buildTutorStubTypedActionDecision,
  supportLevelForAction,
  tutorStubMoveFamilyForAction,
} from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import { actionRecord } from '../scripts/export-adaptive-state-benchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_PUBLIC_LEARNER_OBSERVATION =
  'I am not sure because I do not understand the basic concept behind the public mark.';

function fixtureBelief() {
  return estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: 'I am not sure; can you just tell me the next step?' }],
    turnIndex: 2,
  });
}

function fixtureTask() {
  return {
    taskId: 'marrick-proof-path',
    knowledgeComponent: 'evidence-to-warrant linkage',
    prerequisitePath: ['identify public evidence', 'state the warrant'],
    itemDifficulty: 0.62,
  };
}

function tutorStubRuntimeEvents({ typedActions = false, turns = 1 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `tutor-stub-typed-runtime-${typedActions ? 'on' : 'off'}-`));
  const fakeCodex = path.join(tmp, 'codex');
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const response = input.includes('You are an automated learner')
    ? ${JSON.stringify(NEXT_PUBLIC_LEARNER_OBSERVATION)}
    : 'Which public mark would you test next, and why?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
  const args = [
    'scripts/tutor-stub.js',
    '--model',
    'codex.gpt-5.6-terra',
    '--auto-learner-model',
    'codex.gpt-5.6-terra',
    '--auto-learner',
    '--auto-turns',
    String(turns),
    '--once',
    'I am not sure; can you just tell me which public clue matters?',
    '--world',
    'world_005_marrick',
    '--no-classifier',
    '--register-policy',
    'random',
    '--safe-registers',
    '--no-opening',
    '--no-stream',
    '--no-interim-animation',
    '--no-closeout-report',
    '--trace-dir',
    tmp,
  ];
  if (typedActions) {
    args.push(
      '--typed-actions',
      '--typed-action-task-id',
      'marrick-proof-path',
      '--typed-action-knowledge-component',
      'evidence-to-warrant-linkage',
      '--typed-action-prerequisites',
      'identify public evidence,state the warrant',
      '--typed-action-item-difficulty',
      '0.62',
      '--typed-action-support-level',
      '3',
    );
  }
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
      CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
    },
  });
  if (result.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.fail(`tutor-stub exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  const tracePath = fs
    .readdirSync(tmp)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(tmp, name))
    .at(0);
  assert.ok(tracePath);
  const events = fs
    .readFileSync(tracePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  fs.rmSync(tmp, { recursive: true, force: true });
  return events;
}

test('every canonical action maps into one of the five experimental move families', () => {
  for (const action of ADAPTATION_ACTIONS) {
    assert.ok(TUTOR_STUB_MOVE_FAMILIES.includes(tutorStubMoveFamilyForAction(action.action_type)));
    assert.ok(Number.isInteger(supportLevelForAction(action.action_type)));
  }
});

test('the adapter extends a selected Plan 2 action without replacing its semantics', () => {
  const belief = fixtureBelief();
  const selection = selectPedagogicalAction({ stateBelief: belief, mode: 'closed_loop' });
  const adapted = adaptPedagogicalActionToTutorStub({
    action: selection.selectedAction,
    task: fixtureTask(),
    register: 'plain',
  });

  assert.equal(adapted.schema, 'adaptive-tutor.pedagogical-action.v2.0');
  assert.equal(adapted.version, '2.0');
  assert.equal(adapted.action_type, selection.selectedAction.action_type);
  assert.equal(adapted.target_axes.join(','), selection.selectedAction.target_axes.join(','));
  assert.equal(adapted.task_id, 'marrick-proof-path');
  assert.equal(adapted.knowledge_component, 'evidence-to-warrant linkage');
  assert.equal(adapted.register, 'plain');
  assert.deepEqual(adapted.expected_evidence.success, selection.selectedAction.success_signal.required_evidence);

  const contract = createAdaptationContract({
    dialogueId: 'typed-action-fixture',
    turnIndex: 2,
    stateBelief: belief,
    selectedAction: adapted,
    candidateActions: selection.candidateActions,
  });
  assert.equal(contract.selected_action.version, '2.0');
});

test('move, support, task, and register are independently manipulable', () => {
  const belief = fixtureBelief();
  const selection = selectPedagogicalAction({ stateBelief: belief });
  const lowPlain = adaptPedagogicalActionToTutorStub({
    action: selection.selectedAction,
    task: fixtureTask(),
    register: 'plain',
    supportLevel: 0,
  });
  const highWarm = adaptPedagogicalActionToTutorStub({
    action: selection.selectedAction,
    task: fixtureTask(),
    register: 'warm',
    supportLevel: 3,
  });

  assert.equal(lowPlain.action_type, highWarm.action_type);
  assert.equal(lowPlain.move_family, highWarm.move_family);
  assert.equal(lowPlain.task_id, highWarm.task_id);
  assert.equal(lowPlain.item_difficulty, highWarm.item_difficulty);
  assert.equal(lowPlain.support_level, 0);
  assert.equal(highWarm.support_level, 3);
  assert.equal(lowPlain.register, 'plain');
  assert.equal(highWarm.register, 'warm');
});

test('decision records preserve candidates, propensity, versions, and separate realization patches', () => {
  const belief = fixtureBelief();
  const selection = selectPedagogicalAction({ stateBelief: belief });
  const decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief: belief,
    task: fixtureTask(),
    register: 'precise',
    supportLevel: 1,
    selectionProbability: 0.4,
    vetoes: [{ action_type: 'model_worked_example', reason: 'release_gate' }],
    modelVersion: 'mock/mock',
  });

  assert.equal(decision.schema, 'machinespirits.tutor-stub.typed-action-decision.v1');
  assert.equal(decision.selection_probability, 0.4);
  assert.equal(decision.full_candidate_set.length, selection.candidateActions.length);
  assert.equal(decision.chosen_action.action_type, selection.selectedAction.action_type);
  assert.equal(decision.response_configuration_patch.action_family, decision.chosen_action.move_family);
  assert.equal(decision.register_selection.selected_register, 'precise');
  assert.equal(decision.vetoes_and_repairs[0].reason, 'release_gate');
});

test('the adapter fails closed on unidentified task difficulty or propensity', () => {
  const belief = fixtureBelief();
  const selection = selectPedagogicalAction({ stateBelief: belief });
  assert.throws(
    () =>
      adaptPedagogicalActionToTutorStub({
        action: selection.selectedAction,
        task: { ...fixtureTask(), itemDifficulty: 2 },
        register: 'plain',
      }),
    /itemDifficulty must be in \[0, 1\]/u,
  );
  assert.throws(
    () =>
      buildTutorStubTypedActionDecision({
        selection,
        stateBelief: belief,
        task: fixtureTask(),
        register: 'plain',
        selectionProbability: 1.2,
      }),
    /selectionProbability must be in \[0, 1\]/u,
  );
});

test('typed-action runtime is default-off and leaves the tutor prompt and turn schema unchanged', () => {
  const events = tutorStubRuntimeEvents({ typedActions: false, turns: 1 });
  assert.equal(
    events.some((event) => event.type === 'tutor_typed_action_decision'),
    false,
  );
  assert.equal(
    events.some((event) => event.type === 'tutor_typed_action_outcome_closed'),
    false,
  );
  assert.equal(
    events.some((event) => event.type === 'tutor_scaffold_lifecycle_transition'),
    false,
  );
  const tutorCall = events.find((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
  const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
  assert.ok(tutorCall);
  assert.doesNotMatch(tutorCall.request.systemPrompt, /Tutor-only typed pedagogical action/u);
  assert.equal(Object.hasOwn(turn, 'typedActionDecision'), false);
  assert.equal(Object.hasOwn(turn, 'typedActionPriorOutcome'), false);
  assert.equal(Object.hasOwn(turn, 'scaffoldLifecycle'), false);
});

test('opt-in runtime decides before output with separate axes and complete selection provenance', () => {
  const events = tutorStubRuntimeEvents({ typedActions: true, turns: 2 });
  const decisions = events.filter((event) => event.type === 'tutor_typed_action_decision');
  const lifecycleEvents = events.filter((event) => event.type === 'tutor_scaffold_lifecycle_transition');
  const tutorCalls = events.filter((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
  const turns = events.filter((event) => event.type === 'turn_complete').map((event) => event.turnRecord);
  assert.equal(decisions.length, 2);
  assert.equal(tutorCalls.length, 2);
  assert.equal(turns.length, 2);
  assert.deepEqual(
    lifecycleEvents.map((event) => `${event.transition.from}->${event.transition.to}`),
    ['diagnose->diagnose', 'diagnose->support', 'support->observe_uptake'],
  );

  for (let index = 0; index < decisions.length; index += 1) {
    const decisionEvent = decisions[index];
    const decision = decisionEvent.decision;
    const tutorCall = tutorCalls[index];
    const turn = turns[index];
    assert.ok(decisionEvent.seq < tutorCall.seq, `turn ${index + 1} decision must precede tutor model call`);
    assert.equal(decisionEvent.phase, 'before_tutor_output');
    assert.doesNotMatch(tutorCall.request.systemPrompt, /Tutor-only typed pedagogical action/u);
    const firstDraftPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.match(firstDraftPrompt, /Tutor-only first-draft performance contract/u);
    assert.match(firstDraftPrompt, /SUPPORT — Supply strong concrete support now/u);
    assert.deepEqual(turn.typedActionDecision, decision);

    assert.equal(turn.responseConfiguration.action_family, decision.chosen_action.move_family);
    assert.equal(turn.responseConfiguration.support_level, 3);
    assert.equal(turn.responseConfiguration.task_id, 'marrick-proof-path');
    assert.equal(turn.responseConfiguration.knowledge_component, 'evidence-to-warrant-linkage');
    assert.equal(turn.responseConfiguration.item_difficulty, 0.62);
    assert.equal(turn.registerSelection.engagement_stance, decision.chosen_action.register);
    assert.equal(decision.response_configuration_patch.action_family, decision.chosen_action.move_family);
    assert.equal(Object.hasOwn(decision.response_configuration_patch, 'engagement_stance'), false);
    assert.equal(decision.chosen_action.support_level, 3);
    assert.equal(decision.chosen_action.task_id, 'marrick-proof-path');
    assert.equal(decision.chosen_action.register, turn.registerSelection.engagement_stance);

    assert.equal(decision.selection_probability, 1);
    assert.equal(decision.decision_provenance.propensity.method, 'deterministic_policy');
    assert.equal(decision.decision_provenance.public_only, true);
    assert.deepEqual(
      decision.full_candidate_set.map((candidate) => candidate.action_type),
      decision.decision_provenance.considered_candidates,
    );
    assert.equal(
      decision.full_candidate_set.length + decision.vetoes_and_repairs.length,
      decision.decision_provenance.candidate_universe.length,
    );
    assert.ok(decision.full_candidate_set.every((candidate) => Number.isFinite(candidate.utility)));
    assert.ok(decision.full_candidate_set.every((candidate) => Number.isFinite(candidate.expected_state_gain)));
    assert.ok(decision.full_candidate_set.every((candidate) => Number.isFinite(candidate.mismatch_risk)));
    assert.ok(
      decision.full_candidate_set.some((candidate) => candidate.action_type === decision.chosen_action.action_type),
    );
    assert.equal(decision.adaptation_contract.contract_id, decision.contract_id);
    assert.equal(decision.scaffold_lifecycle.transition.event_kind, 'typed_action_decision');
    assert.equal(decision.decision_provenance.scaffold_lifecycle_gate.phase, index === 0 ? 'diagnose' : 'support');
    assert.ok(
      decision.decision_provenance.scaffold_lifecycle_gate.allowed_move_families.includes(
        decision.chosen_action.move_family,
      ),
    );
    assert.deepEqual(turn.scaffoldLifecycle, decision.scaffold_lifecycle.after);
    assert.ok(turn.scaffoldLifecycleTransitions.length >= 1);
  }
});

test('the next public learner observation closes the prior typed action outcome', () => {
  const events = tutorStubRuntimeEvents({ typedActions: true, turns: 2 });
  const decisions = events.filter((event) => event.type === 'tutor_typed_action_decision');
  const outcomeEvent = events.find((event) => event.type === 'tutor_typed_action_outcome_closed');
  const secondTurn = events.filter((event) => event.type === 'turn_complete').at(1)?.turnRecord;
  assert.ok(outcomeEvent);
  assert.ok(outcomeEvent.seq < decisions[1].seq, 'prior outcome must close before the next action is selected');
  assert.equal(outcomeEvent.outcome.schema, 'machinespirits.tutor-stub.typed-action-outcome.v1');
  assert.equal(outcomeEvent.outcome.contract_id, decisions[0].decision.contract_id);
  assert.equal(outcomeEvent.outcome.decision_turn, 1);
  assert.equal(outcomeEvent.outcome.observation_turn, 2);
  assert.equal(outcomeEvent.outcome.public_learner_observation, NEXT_PUBLIC_LEARNER_OBSERVATION);
  assert.equal(outcomeEvent.outcome.closed_record.status, 'closed');
  assert.notEqual(outcomeEvent.outcome.outcome, null);
  assert.equal(outcomeEvent.outcome.scaffold_lifecycle_transition.from, 'diagnose');
  assert.equal(outcomeEvent.outcome.scaffold_lifecycle_transition.to, 'support');
  assert.deepEqual(secondTurn.typedActionPriorOutcome, outcomeEvent.outcome);
});

test('--resume-last restores the pending typed action and its scaffold lifecycle before the next turn', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-typed-resume-'));
  const fakeCodex = path.join(tmp, 'codex');
  fs.writeFileSync(
    fakeCodex,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
process.stdin.resume();
process.stdin.on('end', () => {
  const response = 'Which public mark would you test next, and why?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(fakeCodex, 0o755);
  const baseArgs = [
    'scripts/tutor-stub.js',
    '--model',
    'codex.gpt-5.6-terra',
    '--world',
    'world_005_marrick',
    '--no-classifier',
    '--register-policy',
    'random',
    '--safe-registers',
    '--no-opening',
    '--no-stream',
    '--no-interim-animation',
    '--no-closeout-report',
    '--trace-dir',
    tmp,
    '--typed-actions',
    '--typed-action-task-id',
    'marrick-proof-path',
    '--typed-action-knowledge-component',
    'evidence-to-warrant-linkage',
    '--typed-action-prerequisites',
    'identify public evidence,state the warrant',
    '--typed-action-item-difficulty',
    '0.62',
    '--typed-action-support-level',
    '3',
  ];
  const run = (extraArgs) =>
    spawnSync(process.execPath, [...baseArgs, ...extraArgs], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15_000,
      env: {
        ...process.env,
        PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      },
    });
  const readTrace = (filePath) =>
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  try {
    const first = run(['--once', 'I am not sure; can you just tell me which public clue matters?']);
    assert.equal(first.status, 0, `first run failed\nstdout:\n${first.stdout}\nstderr:\n${first.stderr}`);
    const sourceTrace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => path.join(tmp, name))
      .at(0);
    assert.ok(sourceTrace);
    const sourceEvents = readTrace(sourceTrace);
    const sourceDecision = sourceEvents.find((event) => event.type === 'tutor_typed_action_decision')?.decision;
    assert.ok(sourceDecision?.contract_id);

    const second = run(['--resume-last', '--once', NEXT_PUBLIC_LEARNER_OBSERVATION]);
    assert.equal(second.status, 0, `resume run failed\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`);
    const resumedEvents = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => readTrace(path.join(tmp, name)))
      .find((events) => events.some((event) => event.type === 'resume_loaded'));
    assert.ok(resumedEvents);

    const resumeEvent = resumedEvents.find((event) => event.type === 'resume_loaded');
    assert.deepEqual(resumeEvent.typedActions, {
      enabled: true,
      restored: true,
      ledgerRecords: 1,
      closedRecords: 0,
      pendingContractId: sourceDecision.contract_id,
      currentActionType: sourceDecision.chosen_action.action_type,
      phase: 'diagnose',
      lifecycleTransitions: 1,
    });
    assert.match(second.stdout, new RegExp(`pending ${sourceDecision.contract_id}`));

    const outcomeEvent = resumedEvents.find((event) => event.type === 'tutor_typed_action_outcome_closed');
    const resumedDecision = resumedEvents.find((event) => event.type === 'tutor_typed_action_decision');
    const lifecycleEvents = resumedEvents.filter((event) => event.type === 'tutor_scaffold_lifecycle_transition');
    const resumedTurn = resumedEvents.find((event) => event.type === 'turn_complete')?.turnRecord;
    assert.equal(outcomeEvent.outcome.contract_id, sourceDecision.contract_id);
    assert.equal(outcomeEvent.outcome.closed_record.status, 'closed');
    assert.ok(outcomeEvent.seq < resumedDecision.seq);
    assert.equal(resumedDecision.decision.decision_provenance.scaffold_lifecycle_gate.phase, 'support');
    assert.deepEqual(
      lifecycleEvents.map((event) => `${event.transition.from}->${event.transition.to}`),
      ['diagnose->support', 'support->observe_uptake'],
    );
    assert.equal(resumedTurn.turn, 2);
    assert.equal(resumedTurn.typedActionPriorOutcome.contract_id, sourceDecision.contract_id);
    assert.equal(resumedTurn.scaffoldLifecycle.pending_contract_id, resumedDecision.decision.contract_id);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('state benchmark export falls back to the register-selection typed decision', () => {
  const belief = fixtureBelief();
  const selection = selectPedagogicalAction({ stateBelief: belief });
  const decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief: belief,
    task: fixtureTask(),
    register: 'warm',
    selectionProbability: 1,
  });
  const exported = actionRecord(
    {
      typedActionDecision: '[circular]',
      registerSelection: { typed_action_decision: decision },
    },
    { task_id: 'legacy-task', item_difficulty: 0.5 },
  );

  assert.equal(exported.action_type, decision.chosen_action.action_type);
  assert.equal(exported.task_id, 'marrick-proof-path');
  assert.equal(exported.register, 'warm');
  assert.equal(exported.selection_probability, 1);
});
