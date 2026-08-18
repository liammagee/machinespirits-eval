import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { buildDerivationAssessment } from '../services/dramaticDerivation/assessment.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  renderDerivationIndexHtml,
  renderDerivationLiveIndexHtml,
  renderDerivationLiveRunHtml,
  renderDerivationRunHtml,
} from '../scripts/browse-poetics-scripts.js';

process.env.TZ = 'UTC';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Every page carries the rail, and the rail carries a command palette built from
// the live workplan board. That made these byte contracts hostage to repo state:
// each merge to main is followed by a "workplan: refresh generated views
// [skip ci]" commit, so the board moved, the bytes moved, and main went red where
// no CI run could see it. The contract exists to freeze the RENDERER, not the
// board, so the test pins its input instead: WORKPLAN_DIR (read per call by the
// browser's workplanDir()) points at a fixture board that only changes when
// someone edits it on purpose. `assertBoardIsPinned` below fails loudly if that seam
// ever stops working, rather than letting the digests drift again.
process.env.WORKPLAN_DIR = path.join(ROOT, 'tests/fixtures/workplan');

// The palette carries two more live inputs beside the board: recent proof runs and
// recent replay bundles, both read from exports/. exports/ is ignored by default but
// carries force-added exceptions, so the proof-run half was reading 207 tracked files
// and the replay half was reading whatever a developer had run locally. Either way
// the bytes answered to repo and disk state rather than to the renderer.
//
// Pin both at fixtures that hold ONE artifact each, not at an empty location: an
// empty pin would agree with a bare checkout but would quietly drop the populated
// palette path out of the contract altogether.
process.env.DERIVATION_LOOP_DIR = path.join(ROOT, 'tests/fixtures/derivation-loop');
process.env.POETICS_REPLAYS_DIR = path.join(ROOT, 'tests/fixtures/replay-bundles');

function fixture() {
  const diagnosis = {
    group: 'fixture-group',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 2,
    turnCap: 4,
    firstForcedTurn: 2,
    assertedGroundedTurn: 2,
    forcedToAssertedGap: 0,
    longestPlateau: 1,
    aporiaWindow: 2,
    releaseAdherence: { onCue: 1, rows: [{}], deviations: [], missed: [], unscheduled: [] },
    learningSlope: {
      d0: 2,
      dFinal: 0,
      overall: { ratePerTurn: 1, turns: 2 },
      perAct: [{ act: '1', title: 'Inquiry', turns: [1, 2], ratePerTurn: 1, delta: 2 }],
    },
    eventsByType: { forced: 1, grounded_anagnorisis: 1 },
    staging: { source: 'director', movements: [{}], tutorNotes: [{}] },
    tutorFigures: { superego: { interventions: 1, watched: 2, withinTurnChanges: 1 } },
    tutorStallWatch: true,
    dials: { recognition: 2, charisma: 1 },
    dialogueDiscipline: {
      tutor: { turns: 2, avgSentences: 1, maxSentences: 1, avgWords: 9 },
      learner: { turns: 2, avgSentences: 1, maxSentences: 1, avgWords: 8 },
    },
    backend: {
      mode: 'mock',
      roles: {
        tutor: { provider: 'fixture', model: 'tutor-model' },
        learner: { provider: 'fixture', model: 'learner-model' },
      },
    },
    elapsedMs: 2500,
    usage: { calls: 4, costUSD: 0.0123 },
    scriptPath: 'config/drama-derivation/fixture-script.yaml',
    worldPath: 'config/drama-derivation/world-000-smoke.yaml',
    note: 'synthetic baseline',
  };
  const result = {
    worldId: 'world_000_smoke',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 2,
    firstForcedTurn: 2,
    assertedGroundedTurn: 2,
    trajectory: [
      { turn: 1, D: 2 },
      { turn: 2, D: 0 },
    ],
    transcript: [
      {
        turn: 1,
        role: 'director',
        text: 'The inquiry opens.',
        meta: {
          phase: { name: 'Inquiry', intent: 'separate claim from evidence' },
          tutorNote: 'Hold the question.',
          release: 'p1',
        },
      },
      {
        turn: 1,
        role: 'tutor',
        text: 'What does the record establish?',
        meta: {
          move: { figure: 'erotema', targetPremise: 'p1', intent: 'orient' },
          release: 'p1',
          deliberation: {
            intervened: true,
            note: 'Keep ownership with the learner.',
            draftFigure: 'analogia',
          },
        },
      },
      {
        turn: 1,
        role: 'learner',
        text: 'It establishes the first premise.',
        meta: { adopt: [['premise', 'one']], hypothesis: 'the conclusion follows later' },
      },
      {
        turn: 2,
        role: 'learner',
        text: 'Then the hidden conclusion follows.',
        meta: { retract: [['guess', 'old']], asserts: ['secret', 'known'] },
      },
      { turn: 2, role: 'observer', text: 'The board closes.', meta: {} },
    ],
    events: [
      { turn: 2, type: 'forced', detail: 'the secret became derivable' },
      { turn: 2, type: 'warning', detail: 'synthetic non-success event' },
    ],
    ledger: [],
    proof: {
      fact: ['secret', 'known'],
      rule: 'R1_fixture',
      premises: [{ fact: ['premise', 'one'], base: true }],
    },
  };
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
  const assessment = buildDerivationAssessment({ label: 'fixture-run', world, result, diagnosis });
  const live = {
    label: 'fixture-live',
    worldId: 'world_000_smoke',
    worldTitle: 'Fixture live world',
    worldPath: 'config/drama-derivation/world-000-smoke.yaml',
    scriptPath: 'config/drama-derivation/fixture-script.yaml',
    status: 'running',
    effectiveStatus: 'running',
    completeAvailable: false,
    updatedAt: '2026-08-10T00:00:00.000Z',
    mtimeMs: Date.parse('2026-08-10T00:00:00.000Z'),
    turnCap: 4,
    latest: { turn: 2, D: 1 },
    backend: { mode: 'mock' },
    turns: [
      {
        turn: 1,
        D: 2,
        phase: { name: 'Inquiry' },
        forced: false,
        released: ['p1'],
        adopted: 1,
        retracted: 0,
        derived: 0,
        overreached: 0,
        intervened: true,
        asserted: false,
        decayedNow: [],
        repairedNow: [],
        lines: [
          { role: 'tutor', text: 'What follows?', meta: { deliberation: { note: 'Ask once.' } } },
          { role: 'learner', text: 'The first premise.' },
        ],
        events: [],
      },
      {
        turn: 2,
        D: 1,
        forced: true,
        released: [],
        adopted: 0,
        retracted: 1,
        derived: 1,
        overreached: 1,
        intervened: false,
        asserted: true,
        decayedNow: ['p1'],
        repairedNow: ['p1'],
        endedBy: 'director',
        lines: [{ role: 'director', text: 'Close the movement.' }],
        events: [{ type: 'warning', detail: 'synthetic event' }],
      },
    ],
  };
  const indexRun = {
    label: 'fixture-run',
    mtimeMs: Date.parse('2026-08-09T12:34:00.000Z'),
    diagnosis,
    hasNotice: true,
  };
  return { assessment, diagnosis, indexRun, live, result, world };
}

function digest(html) {
  return {
    bytes: Buffer.byteLength(html),
    hash: crypto.createHash('sha256').update(html).digest('hex'),
  };
}

// Proof that the pinned board reached the page. If the WORKPLAN_DIR seam ever
// breaks, the palette falls back to the live board and these titles vanish — a
// named failure instead of six drifting digests.
function assertBoardIsPinned(html) {
  for (const title of [
    'Fixture active item',
    'Fixture review item',
    'Fixture blocked item',
    'Fixture scriptorium item',
  ])
    assert.match(html, new RegExp(title, 'u'));
}

// Proof that the two exports/ pins reached the page: exactly one recent artifact of
// each kind, the fixtures' own. More than one means the real exports/ directory was
// read; none means the seam broke and the readers found nothing.
function assertArtifactRecentsArePinned(html) {
  assert.equal((html.match(/"type":"proof run"/gu) || []).length, 1);
  assert.equal((html.match(/"type":"replay bundle"/gu) || []).length, 1);
  assert.match(html, /fixture-proof-run/u);
  assert.match(html, /fixture-bundle/u);
}

function assertInlineScriptsParse(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  for (const source of scripts) new vm.Script(source);
}

test('derivation index renderers preserve empty and populated page bytes', () => {
  const { indexRun, live } = fixture();
  const empty = renderDerivationIndexHtml([], {}, []);
  assertBoardIsPinned(empty);
  assertArtifactRecentsArePinned(empty);
  assert.deepEqual(digest(empty), {
    bytes: 164051,
    hash: 'a314770f1ea22c7fa1c5511303c64e0ffa82590a71faa85399ade6f69bf8424b',
  });
  const populated = renderDerivationIndexHtml([indexRun], { compare: 'fixture-run,missing' }, [live]);
  assert.deepEqual(digest(populated), {
    bytes: 169203,
    hash: 'b13b780116dfa86b987493a9477f85f8a70a73db6a7d810ca681efa7b61d03ed',
  });
  assertInlineScriptsParse(populated);
});

test('live derivation renderers preserve empty, populated, and run page bytes', () => {
  const { live } = fixture();
  const emptyLive = renderDerivationLiveIndexHtml([]);
  assertBoardIsPinned(emptyLive);
  assertArtifactRecentsArePinned(emptyLive);
  assert.deepEqual(digest(emptyLive), {
    bytes: 92881,
    hash: 'e49f0441966bc02bd10ee563722dec0e96a853a2314b9c25319da8f909df23b6',
  });
  assert.deepEqual(digest(renderDerivationLiveIndexHtml([live])), {
    bytes: 93126,
    hash: '8e5b7c2f1425381cacabdb792d6b18e6c3176ef84a196add011978f07e5c79a4',
  });
  const run = renderDerivationLiveRunHtml(live);
  assert.deepEqual(digest(run), {
    bytes: 99084,
    hash: '357e3a15062db1933835736c3a5084f5d3608f50246099b6e1dbbf4230050f1d',
  });
  assertInlineScriptsParse(run);
});

test('completed derivation renderer preserves its populated proof page byte contract', () => {
  const { assessment, diagnosis, result, world } = fixture();
  const html = renderDerivationRunHtml({
    label: 'fixture-run',
    diagnosis,
    result,
    world,
    commentary: '# Notice\n\nThe fixture commentary holds.',
    assessment,
  });
  assertBoardIsPinned(html);
  assertArtifactRecentsArePinned(html);
  assert.deepEqual(digest(html), {
    bytes: 177231,
    hash: '8de711eed89e5a5317031c00dfc0ee1b91d395971ee884d6e083da797f190137',
  });
  assert.match(html, /id="authored-proof-dag"/u);
  assert.match(html, /id="learner-proof-dag"/u);
  assert.match(html, /data-tts-full/u);
  assertInlineScriptsParse(html);
});

test('derivation presentation remains filesystem-free and the browser executable delegates to it', () => {
  const owner = fs.readFileSync(path.join(ROOT, 'services/poeticsDerivationPresentation.js'), 'utf8');
  const browser = fs.readFileSync(path.join(ROOT, 'scripts/browse-poetics-scripts.js'), 'utf8');
  assert.match(browser, /createPoeticsDerivationPresentation/u);
  assert.doesNotMatch(browser, /function renderDerivationRunHtml/u);
  assert.match(owner, /function renderDerivationRunHtml/u);
  assert.doesNotMatch(owner, /\bexpress\b|\bopenPoeticsStore\b|\bfs\./u);
  assert.match(browser, /app\.get\('\/derivation'/u);
  assert.match(browser, /app\.get\('\/derivation\/live'/u);
  assert.match(browser, /app\.get\('\/derivation\/:label'/u);
});
