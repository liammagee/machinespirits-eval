import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_READER_MODEL,
  buildReaderPackets,
  boardChannel,
  collectCrossedDialogues,
  consensus,
  plannedReaderCalls,
  readerOutputSchema,
  renderCrossedScoreMarkdown,
  runScoreboardCrossedReaders,
  scoreScoreboardCrossedRun,
} from '../services/tutorStubScoreboardCrossedReaders.js';
import { buildScoreboard, loadScoreboardWorld, traceDialogueIdentity } from '../services/tutorStubScoreboard.js';
import { main } from '../scripts/run-scoreboard-crossed-readers.js';

// ---------------------------------------------------------------------------
// Fixture: four synthetic world-101 traces, one per cell. No archive is read.
// ---------------------------------------------------------------------------

const WORLD_ID = 'world_101_kestrel_signal_lamp';
const world = loadScoreboardWorld(WORLD_ID, { rootDir: process.cwd() });
const OPENING =
  'Who wiped the mess-hall signal lamp’s message core on signal drill night? Choose something to examine.';

function runStart(profile, policy, tutorModel = 'claude-code.claude-sonnet-5') {
  const [provider, ...rest] = tutorModel.split('.');
  return {
    type: 'run_start',
    metadata: {
      world: { id: WORLD_ID, title: world.title },
      resolved: { provider, model: rest.join('.') },
      experiment: { runSeed: 20260711, profile, policy, repeat: 1, jobId: `${profile}-${policy}-r1` },
      autoLearner: { profileId: profile },
      provenance: { git: { sha: 'fixture', branch: 'fixture', dirty: false } },
    },
  };
}

function turn(n, learner, tutor, record = {}) {
  return {
    type: 'turn_complete',
    turn: n,
    turnRecord: {
      turn: n,
      learner,
      tutor,
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: [] },
        accepted: { adopt: [], retract: [], derive: [] },
      },
      proofDebt: { open: [], discharged: [] },
      releasePacing: { releasedNow: [], dueNow: [] },
      warrantGateDecision: { secret: 'not for readers' },
      ...record,
    },
  };
}

const adoptClamp = {
  tutorLearnerDagUpdate: {
    preflight: { eligiblePublicPremiseIds: ['p_clamp'] },
    accepted: { adopt: ['p_clamp'], retract: [], derive: [] },
  },
};
const assertRuna = {
  tutorLearnerDagUpdate: {
    preflight: { eligiblePublicPremiseIds: [] },
    accepted: { adopt: [], retract: [], derive: [], assertAnswer: 'runa' },
  },
};

const FIXTURES = {
  'low_agency-board': [
    runStart('low_agency', 'board'),
    { type: 'tutor_opening', text: OPENING },
    turn(1, 'Should I look at the docking record?', 'That is your call. Pick one record and tell me what you find.'),
    turn(2, 'Kite’s docking shows access to the lamp.', 'Good. What else would you need?', adoptClamp),
  ],
  'low_agency-board_blind': [
    runStart('low_agency', 'board_blind'),
    { type: 'tutor_opening', text: OPENING },
    turn(1, 'Should I look at the docking record?', 'Let us start with the docking record.'),
    turn(2, 'Whatever you think is best.', 'Fine. The docking record is next.'),
  ],
  'overconfident-board': [
    runStart('overconfident', 'board'),
    { type: 'tutor_opening', text: OPENING },
    turn(1, 'Runa wiped the core.', 'What evidence would show that Runa touched the panel?', assertRuna),
    turn(2, 'Kite’s docking shows access to the lamp, but not that Kite wiped the core.', 'Good.', adoptClamp),
  ],
  'overconfident-board_blind': [
    runStart('overconfident', 'board_blind'),
    { type: 'tutor_opening', text: OPENING },
    turn(1, 'Runa wiped the core.', 'What evidence would show that Runa touched the panel?', assertRuna),
    turn(2, 'Runa wiped the core, I am sure of it.', 'The record is silent on that.', assertRuna),
  ],
};

function writeFixtures(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreboard-crossed-'));
  for (const [id, events] of Object.entries({ ...FIXTURES, ...extra })) {
    const p = path.join(dir, 'traces', id, 'trace.jsonl');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);
  }
  return dir;
}

/** Fake reader: warrant yes at turn 1, no after; challenge delivered when the reply names evidence. */
function fakeReader(calls) {
  return async (agentConfig, systemPrompt, userPrompt, role, opts) => {
    const packet = JSON.parse(userPrompt);
    calls.push({ agentConfig, role, kind: packet.kind, sampleIds: packet.cases.map((c) => c.sample_id), opts });
    const cases = {};
    for (const c of packet.cases) {
      if (packet.kind === 'warrant') {
        cases[c.sample_id] = { commitment_transition_warranted: c.decision_turn === 1 ? 'yes' : 'no', note: 'fixture' };
      } else {
        const yes = /evidence/iu.test(c.tutor_reply);
        cases[c.sample_id] = {
          challenge_delivered: yes ? 'yes' : 'no',
          challenge_delivered_span: yes ? 'What evidence' : '',
          clue_released: 'no',
          clue_released_span: '',
          test_offered: 'no',
          test_offered_span: '',
          condition_named: 'no',
          condition_named_span: '',
          inquiry_closed: 'no',
          inquiry_closed_span: '',
        };
      }
    }
    return { text: JSON.stringify({ cases_by_sample_id: cases }) };
  };
}

test('collectCrossedDialogues keeps one dialogue per world, profile, policy and repeat', () => {
  const dir = writeFixtures();
  const dialogues = collectCrossedDialogues([path.join(dir, 'traces')]);
  assert.deepEqual(
    dialogues.map((d) => d.id),
    [
      `${WORLD_ID}-low_agency-board-r1`,
      `${WORLD_ID}-low_agency-board_blind-r1`,
      `${WORLD_ID}-overconfident-board-r1`,
      `${WORLD_ID}-overconfident-board_blind-r1`,
    ],
  );
  assert.equal(dialogues[0].tutorModel, 'claude-code.claude-sonnet-5');
  assert.equal(plannedReaderCalls(dialogues, 2), 16);
});

test('reader packets carry public text only and withhold the tutor reply at the decision turn', () => {
  const dir = writeFixtures();
  const [d] = collectCrossedDialogues([path.join(dir, 'traces')]).filter((x) =>
    x.id.includes('overconfident-board-r1'),
  );
  const packets = buildReaderPackets(d);
  const json = JSON.stringify(packets);
  assert.ok(!json.includes('not for readers'), 'no trace internals reach the reader');
  assert.ok(!json.includes('entitlement_status'), 'no board fields reach the reader');
  assert.ok(!json.includes(d.id), 'the dialogue id names the cell, so it never enters a packet');
  for (const word of ['board_blind', 'overconfident', 'low_agency', 'policy', 'profile']) {
    assert.ok(!json.includes(word), `the reader is not told the cell: ${word}`);
  }
  assert.ok(!/\bboard\b/u.test(json), 'the reader is not told which tutor it reads');
  assert.deepEqual(
    packets.warrant.cases.map((c) => c.sample_id),
    ['t1', 't2'],
    'sample ids carry the turn alone',
  );
  const t1 = packets.warrant.cases.find((c) => c.decision_turn === 1);
  assert.deepEqual(
    t1.public_record.map((r) => `${r.turn}:${r.speaker}`),
    ['0:tutor', '1:learner'],
    'the record through learner turn 1 excludes the tutor reply at turn 1',
  );
  const t2 = packets.warrant.cases.find((c) => c.decision_turn === 2);
  assert.deepEqual(
    t2.public_record.map((r) => `${r.turn}:${r.speaker}`),
    ['0:tutor', '1:learner', '1:tutor', '2:learner'],
  );
  assert.equal(packets.delivery.cases.length, 2);
  assert.equal(packets.delivery.cases[0].tutor_reply, 'What evidence would show that Runa touched the panel?');
  const schema = readerOutputSchema('warrant', ['a:t1']);
  assert.deepEqual(schema.properties.cases_by_sample_id.required, ['a:t1']);
  assert.deepEqual(
    readerOutputSchema('delivery', ['a:t1']).properties.cases_by_sample_id.properties['a:t1'].required.length,
    10,
  );
});

test('dry run writes packets and makes zero calls', async () => {
  const dir = writeFixtures();
  const calls = [];
  const result = await runScoreboardCrossedReaders({
    rootDirs: [path.join(dir, 'traces')],
    outDir: path.join(dir, 'readers'),
    dryRun: true,
    callModel: fakeReader(calls),
  });
  assert.equal(calls.length, 0);
  assert.equal(result.plannedCalls, 16);
  assert.equal(result.packets, 8);
  assert.equal(result.run.status, 'dry_run');
  assert.ok(!fs.existsSync(path.join(dir, 'readers', 'responses')));
});

test('the ceiling, the no-self-judging rule and the nemotron/kimi ban all fail before any call', async () => {
  const dir = writeFixtures();
  const calls = [];
  const base = {
    rootDirs: [path.join(dir, 'traces')],
    outDir: path.join(dir, 'readers'),
    callModel: fakeReader(calls),
  };
  await assert.rejects(runScoreboardCrossedReaders({ ...base, maxCalls: 15 }), /at or above the planned 16 calls/u);
  await assert.rejects(
    runScoreboardCrossedReaders({ ...base, maxCalls: 16, readerModel: 'claude-code.claude-sonnet-5' }),
    /no self-judging/u,
  );
  await assert.rejects(
    runScoreboardCrossedReaders({ ...base, maxCalls: 16, readerModel: 'openrouter.nemotron' }),
    /nemotron\/kimi/u,
  );
  assert.equal(calls.length, 0);
});

test('a live run makes the planned calls once, resumes with none, and the scorer reads every endpoint', async () => {
  const dir = writeFixtures();
  const calls = [];
  const opts = {
    rootDirs: [path.join(dir, 'traces')],
    outDir: path.join(dir, 'readers'),
    maxCalls: 16,
    callModel: fakeReader(calls),
  };
  const first = await runScoreboardCrossedReaders(opts);
  assert.equal(first.callsMade, 16);
  assert.equal(first.run.status, 'complete');
  assert.deepEqual(calls[0].agentConfig, { provider: 'codex', model: 'gpt-5.6-luna' });
  assert.equal(calls[0].opts.outputSchema.required[0], 'cases_by_sample_id');
  assert.deepEqual(calls[0].sampleIds, ['t1', 't2'], 'the model sees turn ids only');
  assert.ok(!calls.some((c) => /board|overconfident|low_agency/u.test(JSON.stringify(c.sampleIds))));
  const again = await runScoreboardCrossedReaders(opts);
  assert.equal(again.callsMade, 0, 'existing responses are kept; nothing is resampled');
  assert.equal(calls.length, 16);
  const stored = JSON.parse(
    fs.readFileSync(
      path.join(opts.outDir, 'responses', 'reader-1', `${WORLD_ID}-overconfident-board-r1.warrant.json`),
      'utf8',
    ),
  );
  assert.deepEqual(
    Object.keys(stored.cases_by_sample_id),
    [`${WORLD_ID}-overconfident-board-r1:t1`, `${WORLD_ID}-overconfident-board-r1:t2`],
    'stored responses are keyed by dialogue and turn again',
  );

  const score = scoreScoreboardCrossedRun({ rootDirs: opts.rootDirs, readerDir: opts.outDir, repoRoot: process.cwd() });
  assert.equal(score.dialogues, 4);
  assert.deepEqual(score.seats, {
    tutor_models: ['claude-code.claude-sonnet-5'],
    reader_models: [DEFAULT_READER_MODEL],
  });
  assert.equal(score.self_judging, false);
  const cell = (profile, policy) => score.cells.find((c) => c.profile === profile && c.policy === policy);
  assert.equal(cell('low_agency', 'board').channel_fired, 1, 'a commitment with no licence in force');
  assert.equal(cell('low_agency', 'board_blind').channel_fired, 0);
  assert.equal(cell('overconfident', 'board').channel_fired, 1, 'entitlement repaired after the challenge');
  assert.equal(cell('overconfident', 'board_blind').channel_fired, 0);
  const ob = cell('overconfident', 'board');
  assert.equal(ob.consensus_cases, 2);
  assert.equal(ob.warranted_consensus, 1, 'readers say yes at turn 1 only');
  assert.equal(ob.decisions_correct, 2, 'tutor challenged at turn 1 and not at turn 2');
  assert.equal(ob.decision_correctness, 1);
  assert.equal(ob.warranted_shift_share, 0.5);
  assert.equal(ob.delivery_agreement, 1);
  const lb = cell('low_agency', 'board_blind');
  assert.equal(lb.decisions_correct, 1, 'readers wanted a change at turn 1 and the blind tutor made none');
  assert.deepEqual(
    score.channels.map((c) => [c.shape, c.board_beats_blind]),
    [
      ['permission_seeking', true],
      ['overconfident', true],
    ],
  );
  assert.equal(score.kill.board_not_above_blind_on_either_channel, false);
  assert.equal(score.kill.licence_violation, false);
  assert.equal(score.kill.indeterminate, false);
  const md = renderCrossedScoreMarkdown(score);
  assert.match(md, /Kill 1 \(board not above blind on either channel\): not fired\./u);
  assert.match(md, /Self-judging: no/u);
});

test('a licence violation event in a board trace fires the second kill', () => {
  const violating = [...FIXTURES['low_agency-board']];
  violating.splice(3, 0, { type: 'scoreboard_licence_violation', turn: 1, move: 'close', reason: 'fixture' });
  const dir = writeFixtures({ 'low_agency-board': violating });
  const score = scoreScoreboardCrossedRun({ rootDirs: [path.join(dir, 'traces')], repoRoot: process.cwd() });
  assert.equal(score.kill.licence_violation, true);
  assert.deepEqual(score.kill.licence_violation_dialogues, [`${WORLD_ID}-low_agency-board-r1`]);
  assert.match(renderCrossedScoreMarkdown(score), /Kill 2 \(licence violation by the program\): FIRED/u);
});

test('without readers the scorer still reads the board channel and reports the reader seats as not run', () => {
  const dir = writeFixtures();
  const score = scoreScoreboardCrossedRun({ rootDirs: [path.join(dir, 'traces')], repoRoot: process.cwd() });
  assert.deepEqual(score.seats.reader_models, []);
  for (const c of score.cells) {
    assert.equal(c.consensus_cases, 0);
    assert.equal(c.decision_correctness, null);
  }
  assert.equal(score.kill.indeterminate, false);
});

test('boardChannel and consensus follow the declared rules', () => {
  const dir = writeFixtures();
  const [d] = collectCrossedDialogues([path.join(dir, 'traces')]).filter((x) =>
    x.id.includes('overconfident-board_blind'),
  );
  const board = buildScoreboard({
    events: d.events,
    world,
    arm: 'board_blind',
    identity: traceDialogueIdentity(d.events),
  });
  const ch = boardChannel(board, 'overconfident');
  assert.equal(ch.channel, 'entitlement_repaired_after_challenge');
  assert.equal(ch.fired, false, 'a defaulted reassertion is not a repair');
  assert.equal(consensus(['yes', 'yes']), 'yes');
  assert.equal(consensus(['yes', 'no']), null);
  assert.equal(consensus(['uncertain', 'uncertain']), null);
  assert.equal(consensus(['yes']), null, 'one reader is not a consensus');
});

test('the CLI dry run and score paths run with zero calls', async () => {
  const dir = writeFixtures();
  const lines = [];
  const log = (s) => lines.push(String(s));
  const code = await main(['--traces', path.join(dir, 'traces'), '--out', path.join(dir, 'readers'), '--dry-run'], {
    log,
  });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /16 calls planned, 0 made/u);
  const scoreOut = path.join(dir, 'score.json');
  const code2 = await main(['--traces', path.join(dir, 'traces'), '--score', '--score-out', scoreOut], { log });
  assert.equal(code2, 0);
  assert.ok(fs.existsSync(scoreOut));
  assert.match(lines.join('\n'), /permission_seeking channel: board 100%, blind 0%: board above blind\./u);
});
