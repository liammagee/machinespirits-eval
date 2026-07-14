import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubReleasePacing,
  commitTutorStubReleasePacing,
  createTutorStubReleasePacingState,
  detectTutorStubReleasePacingSignal,
  setTutorStubReleaseSpeed,
  tutorStubReleasePacingSnapshot,
} from '../services/tutorStubReleasePacing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sampleWorld() {
  return {
    releaseSchedule: [
      { premise: 'p_open', turn: 1, via: 'tutor' },
      { premise: 'p_trace', turn: 5, via: 'director' },
      { premise: 'p_witness', turn: 9, via: 'tutor' },
    ],
  };
}

test('release pace 1 preserves the authored clue schedule', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });

  assert.deepEqual(
    tutorStubReleasePacingSnapshot(pacing, world).schedule.map((entry) => entry.effectiveTurn),
    [1, 5, 9],
  );
  assert.deepEqual(
    tutorStubReleasePacingSnapshot(pacing, world).schedule.map((entry) => entry.authoredTurn),
    [1, 5, 9],
  );
});

test('premises authored as one release batch stay together', () => {
  const world = {
    releaseSchedule: [
      { premise: 'p_left', turn: 2, via: 'tutor' },
      { premise: 'p_right', turn: 2, via: 'tutor' },
      { premise: 'p_later', turn: 5, via: 'director' },
    ],
  };
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  const initial = tutorStubReleasePacingSnapshot(pacing, world);
  assert.deepEqual(
    initial.schedule.map((entry) => entry.effectiveTurn),
    [2, 2, 5],
  );

  advanceTutorStubReleasePacing({ pacing, world, turn: 2, learnerText: 'Ready.' });
  const committed = commitTutorStubReleasePacing({
    pacing,
    world,
    turn: 2,
    deliveredPremises: ['p_left', 'p_right'],
  });
  assert.deepEqual(committed.releasedNow, ['p_left', 'p_right']);
});

test('a scheduled clue is committed only after the delivered reply actually contains it', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  acknowledgeTutorStubOpeningRelease({ pacing, world });

  for (let turn = 1; turn < 5; turn += 1) {
    advanceTutorStubReleasePacing({ pacing, world, turn, learnerText: 'Continue.' });
    commitTutorStubReleasePacing({ pacing, world, turn, deliveredPremises: [] });
  }
  advanceTutorStubReleasePacing({ pacing, world, turn: 5, learnerText: 'What happens next?' });
  const omitted = commitTutorStubReleasePacing({ pacing, world, turn: 5, deliveredPremises: [] });
  assert.deepEqual(omitted.releasedNow, []);
  assert.deepEqual(omitted.notDeliveredNow, ['p_trace']);
  assert.equal(omitted.schedule.find((entry) => entry.premise === 'p_trace').releasedTurn, null);
  assert.equal(omitted.schedule.find((entry) => entry.premise === 'p_trace').effectiveTurn, 6);

  advanceTutorStubReleasePacing({ pacing, world, turn: 6, learnerText: 'Try again.' });
  const delivered = commitTutorStubReleasePacing({
    pacing,
    world,
    turn: 6,
    deliveredPremises: ['p_trace'],
  });
  assert.deepEqual(delivered.releasedNow, ['p_trace']);
  assert.equal(delivered.schedule.find((entry) => entry.premise === 'p_trace').releasedTurn, 6);
});

test('an explicit move-it-along request releases the next clue now, but only one clue', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  commitTutorStubReleasePacing({ pacing, world, turn: 1, deliveredPremises: ['p_open'] });

  const update = advanceTutorStubReleasePacing({
    pacing,
    world,
    turn: 2,
    learnerText: "This is boring. Let's move it along.",
    tutorLearnerDag: { model: { assessment: { bottleneck: 'release_or_pacing_gap' } } },
  });

  assert.equal(update.direction, 'accelerate');
  assert.equal(update.signal.source, 'explicit_learner_request');
  assert.deepEqual(update.dueNow, ['p_trace']);
  const committed = commitTutorStubReleasePacing({ pacing, world, turn: 2, deliveredPremises: ['p_trace'] });
  assert.deepEqual(committed.releasedNow, ['p_trace']);
  assert.equal(committed.counts.early, 1);
  assert.equal(committed.schedule.find((entry) => entry.premise === 'p_witness').effectiveTurn > 2, true);
});

test('a clue already displayed in the opening is not released again', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  acknowledgeTutorStubOpeningRelease({ pacing, world });

  const steady = advanceTutorStubReleasePacing({ pacing, world, turn: 1, learnerText: 'I follow that.' });
  assert.deepEqual(steady.dueNow, []);
  assert.equal(steady.schedule.find((entry) => entry.premise === 'p_trace').effectiveTurn, 5);

  const fastWorld = sampleWorld();
  const fastPacing = createTutorStubReleasePacingState({ world: fastWorld, speed: 1 });
  acknowledgeTutorStubOpeningRelease({ pacing: fastPacing, world: fastWorld });
  const faster = advanceTutorStubReleasePacing({
    pacing: fastPacing,
    world: fastWorld,
    turn: 1,
    learnerText: 'That follows; give me the next clue.',
  });
  assert.deepEqual(faster.dueNow, ['p_trace']);
});

test('one-clue-at-a-time requests slow the remaining authored schedule', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  commitTutorStubReleasePacing({ pacing, world, turn: 1, deliveredPremises: ['p_open'] });

  const update = advanceTutorStubReleasePacing({
    pacing,
    world,
    turn: 2,
    learnerText: 'Slow down—one clue at a time, please.',
  });

  assert.equal(update.direction, 'decelerate');
  assert.equal(update.signal.source, 'explicit_learner_request');
  assert.equal(update.dueNow.length, 0);
  assert.equal(update.schedule.find((entry) => entry.premise === 'p_trace').effectiveTurn > 5, true);
});

test('the configured base speed changes release timing independently of learner signals', () => {
  const world = sampleWorld();
  const pacing = createTutorStubReleasePacingState({ world, speed: 1 });
  commitTutorStubReleasePacing({ pacing, world, turn: 1, deliveredPremises: ['p_open'] });

  const snapshot = setTutorStubReleaseSpeed({ pacing, world, speed: 2, turn: 2 });
  assert.equal(snapshot.baseSpeed, 2);
  assert.equal(snapshot.schedule.find((entry) => entry.premise === 'p_trace').effectiveTurn, 3);
});

test('direct pacing language is distinguished from inferred analysis', () => {
  assert.equal(detectTutorStubReleasePacingSignal({ learnerText: 'Yep, get to it.' }).direction, 'accelerate');
  assert.equal(detectTutorStubReleasePacingSignal({ learnerText: 'Wait, not so fast.' }).direction, 'decelerate');
  assert.equal(
    detectTutorStubReleasePacingSignal({
      learnerText: 'Okay.',
      classification: { overall: { summary: 'The learner is impatient and ready for the next clue.' } },
    }).source,
    'learner_analysis',
  );
});

test('the live tutor brings a scheduled clue forward and shifts stance after move-it-along', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-live-release-pacing-'));
  try {
    const worldPath = path.join(tmp, 'paced-world.yaml');
    fs.writeFileSync(
      worldPath,
      `id: world_release_pacing_test
title: The Waiting Heir
question: "Who is the rightful heir?"
question_pattern: [heir, "?x"]
secret:
  fact: [heir, marin]
  surface: "Marin is the rightful heir"
mirror:
  fact: [heir, joren]
rules:
  - id: R1_heir
    if:
      - [child, marin, founder]
    then:
      - [heir, marin]
premises:
  - id: p_child
    fact: [child, marin, founder]
    surface: "The archive names Marin as the founder's child"
background: []
incompatible: []
proof_paths:
  - premises: [p_child]
release_schedule:
  - { turn: 4, premise: p_child, via: tutor }
slope:
  t_min: 2
  aporia_window: 2
turn_cap: 6
`,
      'utf8',
    );
    const fakeCodex = path.join(tmp, 'codex');
    const promptLog = path.join(tmp, 'prompts.log');
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
  fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
  const response = input.includes('# Learner-record extraction rules')
    ? JSON.stringify({
        classification: {
          turn: {
            summary: 'The learner is bored and explicitly asks to accelerate.',
            request_type: 'resistance_or_low_agency',
            discourse_move: 'affective_signal',
            evidence_use: 'none',
            epistemic_stance: 'resistant',
            affect: 'bored',
            agency: 'steering',
            scores: {
              conceptual_engagement: { score: 2, reason: 'impatient' },
              epistemic_readiness: { score: 4, reason: 'ready for evidence' }
            },
            pedagogical_need: 'Release the next clue and move forward.'
          },
          overall: {
            summary: 'The learner is impatient and ready for the next clue.',
            trajectory: 'patience declining',
            recurring_pattern: 'requests faster pacing',
            current_state: 'ready for decisive evidence',
            next_best_tutor_move: 'Stage the next public clue concisely.'
          }
        },
        learner_record: { adopt: [], derive: [], notes: 'No new evidence claim.' },
        register_selection: {
          engagement_stance: 'warm',
          reviewer_signal: 'fixture proposes warmth',
          request_type: 'resistance_or_low_agency',
          engagement_stance_reason: 'fixture',
          expected_dag_move: 'wait',
          expected_field_move: 'wait',
          expected_progress_marker: 'wait',
          confidence: 0.8
        }
      })
    : "Fair—let's move. The archive names Marin as the founder's child. What does that establish?";
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
      'utf8',
    );
    fs.chmodSync(fakeCodex, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--once',
        "This is the most boring detective story ever. Let's move it along.",
        '--world',
        worldPath,
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          FAKE_CODEX_LOG: promptLog,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /style brisk, move stage next step, character [^,]+, clue pace faster 1\.75x; 1 new/u,
    );
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    assert.equal(turn.releasePacing.signal.source, 'explicit_learner_request');
    assert.equal(turn.releasePacing.direction, 'accelerate');
    assert.deepEqual(turn.releasePacing.releasedNow, ['p_child']);
    assert.equal(turn.releasePacing.counts.early, 1);
    assert.equal(turn.registerSelection.selected_register, 'brisk');
    assert.equal(turn.responseConfiguration.action_family, 'stage_next_step');
    assert.equal(turn.dramaticRelease.frame.active, true);
    assert.equal(turn.dramaticRelease.frame.requiresExhibitHandoff, true);
    assert.equal(turn.tutorDramaticReleaseAudit.ok, true);
    assert.match(turn.tutor, /put the next exhibit in front of us/u);
    const prompts = fs.readFileSync(promptLog, 'utf8');
    assert.match(prompts, /The archive names Marin as the founder's child/u);
    assert.match(prompts, /\[Tutor-only dramatic clue release\]/u);
    assert.match(prompts, /Make that transition audible/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
