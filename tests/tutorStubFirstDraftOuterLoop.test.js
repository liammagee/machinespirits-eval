import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import {
  summarizeTutorStubFirstDraftOuterLoop,
  validateTutorStubFirstDraftOuterLoop,
} from '../services/tutorStubFirstDraftOuterLoop.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-outer-loop-v1.yaml');
const SCREEN_PATH = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens-v5.yaml');

function loadYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixture(tmp) {
  const manifest = loadYaml(MANIFEST_PATH);
  const screen = loadYaml(SCREEN_PATH);
  const trace = path.join(tmp, 'v23-source.jsonl');
  const auditFixture = path.join(tmp, 'audit-fixture.json');
  fs.writeFileSync(trace, '{}\n');
  fs.writeFileSync(auditFixture, '{}\n');
  screen.matrix[0].source_trace = trace;
  screen.preflight.model_free_fixtures = [auditFixture];
  screen.artifacts.root = path.join(tmp, 'artifacts');
  const screenPath = path.join(tmp, 'working-screen.yaml');
  fs.writeFileSync(screenPath, YAML.stringify(screen));
  manifest.current.working_screen_config = screenPath;
  return { manifest, screen, screenPath };
}

test('outer-loop manifest validates terminal V26 stagnation without predeclaring acceptance or V27', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-loop-'));
  try {
    const { manifest } = fixture(tmp);
    const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(validation.valid, true);
    assert.equal(validation.currentVersion, 26);
    assert.equal(validation.currentState, 'stagnated');
    assert.equal(validation.workingIteration, 3);
    assert.equal(validation.terminalScope, 'version');
    assert.equal(validation.outcome, 'no_progress');
    assert.equal(validation.acceptancePredeclared, false);
    assert.deepEqual(validation.workingScreen.turns, [4, 5, 6, 9]);
    assert.equal(validation.workingScreen.developmentSeed, 20261400);
    assert.deepEqual(validation.seedCounts, {
      historical: 14,
      development: 5,
      heldOut: 0,
      reserve: 0,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop status exposes only declared next states and makes no model call', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-status-'));
  try {
    const { manifest } = fixture(tmp);
    const status = summarizeTutorStubFirstDraftOuterLoop({ manifest, root: tmp });
    assert.equal(status.makesModelCalls, false);
    assert.equal(status.workingIteration, 3);
    assert.equal(status.heldOutMatrixStatus, 'not_predeclared');
    assert.deepEqual(status.developmentSeeds, [
      {
        seed: 20261400,
        cell: 'marrick_v26_structured_composition',
        status: 'consumed_development_retired_after_stagnation',
      },
      {
        seed: 20261401,
        cell: 'skyway_answer_seeking',
        status: 'retired_unstarted_due_to_stagnation',
      },
      {
        seed: 20261402,
        cell: 'nocturne_answer_seeking',
        status: 'retired_unstarted_due_to_stagnation',
      },
      {
        seed: 20261403,
        cell: 'greyfen_answer_seeking',
        status: 'retired_unstarted_due_to_stagnation',
      },
      {
        seed: 20261404,
        cell: 'marrick_answer_seeking_confirmation',
        status: 'retired_unstarted_due_to_stagnation',
      },
    ]);
    assert.deepEqual(
      status.next.map((transition) => transition.state),
      ['working_predeclared'],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop records the exact V26 iteration-3 terminal result without activating V27', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-v26-i3-'));
  try {
    const { manifest } = fixture(tmp);
    const observation = manifest.current.last_observation;
    assert.equal(observation.version, 26);
    assert.equal(observation.working_iteration, 3);
    assert.equal(observation.status, 'stagnated');
    assert.equal(observation.result_artifact, '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v5/iteration-3/working-screen-result.json');
    assert.equal(observation.development_seed, 20261400);
    assert.equal(observation.seed_disposition, 'consumed_development_retired_after_stagnation');
    assert.equal(
        observation.run_head,
        '6f41a8d602539d7811342a218d8213a49e737146',
    );
    assert.equal(observation.provenance.working_screen_config_sha256, '35193154149780818e5aa684dc980c2d6f017166928bd123134c7fc8d7fd4802');
    assert.equal(observation.provenance.source_trace_sha256, 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a');
    assert.equal(observation.provenance.campaign_validation_sha256, '60d2288e07e5b48170fd719a94d26dabba8556a1e112ef63cd273c5953801891');
    assert.equal(observation.provenance.turn_artifact_sha256, '69f8a539863ff40b6f86a0f76a3244045fd1d51d28ec824efa6f385459f0fc1a');
    assert.equal(observation.provenance.result_sha256, '2643b16921017de46573bd4d92ae08dc8a7e7303b07ff094dc798a239b61e1ae');
    assert.deepEqual(observation.completed_turns, [4]);
    assert.deepEqual(observation.unstarted_turns, [5, 6, 9]);
    assert.equal(observation.strict_originals_accepted, 0);
    assert.equal(observation.valid_structured_outputs, 1);
    assert.equal(observation.structured_slot_ownership_passes, 0);
    assert.equal(observation.exact_source_occurrence_passes, 1);
    assert.equal(observation.mean_configuration_realization, 1);
    assert.equal(observation.mean_original_latency_ms, 8930);
    assert.deepEqual(observation.token_usage, { input: 17578, output: 246, total: 17824 });
    assert.equal(observation.comparison.measurable_improvement, false);
    assert.equal(observation.comparison.consecutive_without_improvement, 2);
    assert.equal(observation.comparison.stop, true);
    assert.equal(observation.comparison.reason, 'predeclared_final_frontier_attempt_failed');
    assert.equal(observation.final_frontier_attempt.outcome, 'failed');
    assert.equal(observation.final_frontier_attempt.speaking_change, 'none');
    assert.equal(observation.final_frontier_attempt.recovery_change, 'none');
    assert.equal(observation.final_frontier_attempt.audit_recognition_change, 'none');
    assert.equal(observation.terminal_action.state, 'stagnated');
    assert.equal(observation.terminal_action.v27_status, 'not_activated_or_predeclared');
    assert.deepEqual(observation.terminal_action.retired_unstarted_confirmation_seeds, [20261401, 20261402, 20261403, 20261404]);
    assert.equal(manifest.current.working_history.length, 3);
    assert.equal(manifest.current.working_history[2].working_iteration, 3);
    assert.equal(manifest.current.working_history[2].measurable_improvement, false);
    assert.equal(manifest.current.campaign_version, 26);
    assert.equal(manifest.current.state, 'stagnated');
    assert.equal(manifest.current.working_iteration, 3);
    assert.equal(manifest.current.acceptance_config, null);
    assert.equal(JSON.stringify(manifest).includes('20261500'), false);
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop preserves V25 stagnation and explains the V26 architectural reset', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-observation-'));
  try {
    const { manifest } = fixture(tmp);
    const reset = manifest.current.architectural_reset_from;
    assert.equal(reset.version, 25);
    assert.equal(reset.terminal_state, 'stagnated');
    assert.equal(reset.final_iteration, 4);
    assert.equal(reset.deterministic_strict_originals_accepted, 3);
    assert.equal(reset.adjudicated_typed_plan_originals_accepted, 2);
    assert.deepEqual(reset.retired_unstarted_confirmation_seeds, [20261301, 20261302, 20261303, 20261304]);
    assert.match(reset.reset_reason, /four-field JSON envelope/iu);
    assert.equal(manifest.current.prior_version_history[0].version, 24);
    const resetTransition = manifest.state_machine.transitions.find(
      (transition) => transition.from === 'stagnated' && transition.to === 'working_predeclared',
    );
    assert.equal(resetTransition.version_action, 'increment_by_one');
    assert.equal(manifest.seed_ledger.held_out.entries.length, 0);
    assert.equal(manifest.seed_ledger.reserve.entries.length, 0);
    assert.equal(validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }).valid, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator rejects version jumps and missing Vn to Vn+1 discipline', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-version-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.versioning.next = 28;
    assert.throws(() => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }), /versioning next must be 27/u);
    manifest.versioning.next = 27;
    manifest.versioning.examples[1].to = 28;
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /version example must increment by one/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator rejects held-out seeds before the acceptance predeclaration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-seed-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.seed_ledger.held_out.entries.push({ seed: 20261210, status: 'unconsumed_held_out' });
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /held-out and reserve seeds must remain empty/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator accepts only declared active or retired development seed states', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-development-seed-'));
  try {
    const { manifest } = fixture(tmp);
    manifest.seed_ledger.development[0].status = 'consumed_and_not_reusable';
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /development seed 20261400 has unsupported status consumed_and_not_reusable/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator keeps the V5 reset screen at four strict originals and full configuration realization', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-gate-'));
  try {
    const { manifest, screen, screenPath } = fixture(tmp);
    screen.gates_per_cell.required_originals_accepted = 3;
    fs.writeFileSync(screenPath, YAML.stringify(screen));
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /working screen required originals must be 4/u,
    );
    screen.gates_per_cell.required_originals_accepted = 4;
    screen.gates_per_cell.minimum_mean_configuration_realization = 0.9;
    fs.writeFileSync(screenPath, YAML.stringify(screen));
    assert.throws(
      () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
      /working screen configuration realization must be 1/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator requires terminal V26 evidence and retired development seeds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-stagnated-'));
  try {
    for (const mutate of [
      (manifest, screen) => {
        screen.stopping.final_frontier_attempt_iteration = 4;
      },
      (manifest, screen) => {
        screen.stopping.stop_if_final_frontier_attempt_fails = false;
      },
      (manifest) => {
        manifest.current.last_observation.comparison.consecutive_without_improvement = 1;
      },
      (manifest) => {
        manifest.current.last_observation.comparison.stop = false;
      },
      (manifest) => {
        manifest.current.last_observation.terminal_action.v27_status = 'active';
      },
      (manifest) => {
        manifest.seed_ledger.development[1].status = 'reusable_non_held_out_development';
      },
    ]) {
      const { manifest, screen, screenPath } = fixture(tmp);
      mutate(manifest, screen);
      fs.writeFileSync(screenPath, YAML.stringify(screen));
      assert.throws(
        () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
        /terminal|final-frontier|V27 activation|retire every development/iu,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('outer-loop validator fails closed when a structured working screen omits or disables any structured gate', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-draft-outer-structured-gates-'));
  try {
    for (const [gate, label] of [
      ['require_structured_output', 'structured output gate'],
      ['require_structured_slot_ownership', 'structured slot ownership gate'],
      ['require_exact_source_once', 'exact source once gate'],
    ]) {
      for (const value of [undefined, false]) {
        const { manifest, screen, screenPath } = fixture(tmp);
        if (value === undefined) delete screen.gates_per_cell[gate];
        else screen.gates_per_cell[gate] = value;
        fs.writeFileSync(screenPath, YAML.stringify(screen));
        assert.throws(
          () => validateTutorStubFirstDraftOuterLoop({ manifest, root: tmp }),
          new RegExp(`${label} must be true|gates_per_cell\\.${gate}: true`, 'u'),
        );
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tracked V5 screen applies the V26 structured host plan to the four Marrick frontier turns', () => {
  const screen = loadYaml(SCREEN_PATH);
  assert.equal(screen.id, 'first-draft-working-screens-v5');
  assert.equal(screen.held_out, false);
  assert.equal(screen.fixed_configuration.original_only, true);
  assert.equal(screen.fixed_configuration.draws_per_turn, 1);
  assert.equal(screen.matrix.length, 1);
  assert.deepEqual(screen.matrix[0].turns, [4, 5, 6, 9]);
  assert.equal(screen.fixed_configuration.structured_generation, true);
  assert.equal(screen.matrix[0].development_seed, 20261400);
  assert.equal(screen.gates_per_cell.required_originals_accepted, 4);
  assert.equal(screen.gates_per_cell.minimum_mean_configuration_realization, 1);
  assert.equal(screen.gates_per_cell.configuration_realization_enforcement, 'gate');
  assert.equal(screen.gates_per_cell.maximum_safety_failures, 0);
  assert.equal(screen.gates_per_cell.maximum_fallbacks, 0);
  assert.equal(screen.gates_per_cell.require_transcript_specific_uptake, true);
  assert.equal(screen.gates_per_cell.require_structured_output, true);
  assert.equal(screen.gates_per_cell.require_structured_slot_ownership, true);
  assert.equal(screen.gates_per_cell.require_exact_source_once, true);
  assert.match(screen.change_log.speaking_prompt, /direct question.*learner/isu);
  assert.match(screen.change_log.audit_recognition_only, /bounded.*warm HANDOFF/isu);
  assert.match(screen.change_log.recovery_only, /unchanged/iu);
  assert.match(screen.change_log.speaking_prompt, /Iteration 3 makes no speaking-prompt change/iu);
  assert.match(screen.change_log.audit_recognition_only, /Iteration 3 makes no audit-recognition change/iu);
  assert.match(screen.change_log.recovery_only, /Iteration 3 makes no recovery change/iu);
  assert.equal(screen.stopping.final_frontier_attempt_iteration, 3);
  assert.equal(screen.stopping.stop_if_final_frontier_attempt_fails, true);
});
