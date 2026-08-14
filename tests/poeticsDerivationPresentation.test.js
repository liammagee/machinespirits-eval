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

function assertInlineScriptsParse(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  for (const source of scripts) new vm.Script(source);
}

test('derivation index renderers preserve empty and populated page bytes', () => {
  const { indexRun, live } = fixture();
  assert.deepEqual(digest(renderDerivationIndexHtml([], {}, [])), {
    bytes: 171166,
    hash: '5ec24a7cd3b2cdfa89f1f640e732c92ec70c0dd489609123cd290530ffc2a496',
  });
  const populated = renderDerivationIndexHtml([indexRun], { compare: 'fixture-run,missing' }, [live]);
  assert.deepEqual(digest(populated), {
    bytes: 176318,
    hash: 'bb655a1abaefcbd870d540d11a82d1e9f5489e0956a382132f1de6b127072170',
  });
  assertInlineScriptsParse(populated);
});

test('live derivation renderers preserve empty, populated, and run page bytes', () => {
  const { live } = fixture();
  assert.deepEqual(digest(renderDerivationLiveIndexHtml([])), {
    bytes: 99996,
    hash: '3db4578a25c1ac905cee119f43867052f0cd224f8233d30e73411d5a6f5d287a',
  });
  assert.deepEqual(digest(renderDerivationLiveIndexHtml([live])), {
    bytes: 100241,
    hash: 'f882cef4a662c7316d15af582f73c30bc74da987d4b02a17c27965bc572e4219',
  });
  const run = renderDerivationLiveRunHtml(live);
  assert.deepEqual(digest(run), {
    bytes: 106199,
    hash: '48a92d1cf83c4344295a56846fb078926cde2325d20aaf37c37ee4da58f0aee2',
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
  assert.deepEqual(digest(html), {
    bytes: 184346,
    hash: 'd2f57ebc7b9c1d76130800f7a2cb80ecbd3e6cf52a58809fc249306f3de347d1',
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
