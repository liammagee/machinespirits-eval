// Agon dry-episode integration test — full runner loop with scripted agents.
// Deterministic, zero API calls, zero DB access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadGameConfig } from '../services/agon/referee.js';
import { makeScriptedAgents } from '../services/agon/scripted.js';
import { runEpisode } from '../scripts/agon-run.js';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname_local, '..', 'config', 'agon', 'fractions-agon.yaml');

test('dry episode (A1): scripted attrition play forces two demonstrations', async () => {
  const config = loadGameConfig(CONFIG_PATH);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agon-test-'));
  const jsonlPath = path.join(tmpDir, 'ep.turns.jsonl');

  const result = await runEpisode({
    config,
    arm: 'A1',
    episodeId: 'dry-A1-e1',
    agents: makeScriptedAgents(config),
    jsonlPath,
  });

  const s = result.summary;
  assert.equal(s.turns, 14);
  assert.equal(s.demonstrated, 2);
  assert.equal(s.transferred, 0);
  assert.equal(s.score, 6);
  assert.equal(s.tutorWin, true);
  assert.equal(s.firstDemonstrationTurn, 12);
  assert.equal(s.totalDodgesCharged, 5);
  assert.equal(s.complianceCount, 2);
  assert.equal(s.wastedProbes, 0);
  assert.equal(s.bounces, 0);
  assert.equal(s.leaks, 0);
  assert.deepEqual(s.budgetsRemaining, {
    false_confusion: 0,
    polite_false_mastery: 0,
    affective_shutdown: 0,
    epistemic_resistance: 0,
    answer_seeking: 0,
  });

  // Transcript symmetry + crash-safe JSONL.
  assert.equal(result.transcript.length, 28);
  assert.equal(result.turnRecords.length, 14);
  const jsonlLines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
  assert.equal(jsonlLines.length, 14);
  const lastRow = JSON.parse(jsonlLines.at(-1));
  assert.equal(lastRow.episodeId, 'dry-A1-e1');
  assert.equal(lastRow.adjudication.outcome, 'pass');

  // A1 disclosure carried in every turn record.
  assert.ok(result.turnRecords.every((r) => 'dodgeBudgetsRemaining' in r.disclosure));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('dry episode (A0): same scripted play, blind disclosure, same ledger outcome', async () => {
  const config = loadGameConfig(CONFIG_PATH);
  const result = await runEpisode({
    config,
    arm: 'A0',
    episodeId: 'dry-A0-e1',
    agents: makeScriptedAgents(config),
  });
  assert.equal(result.summary.demonstrated, 2);
  assert.equal(result.summary.score, 6);
  // Blind arm: no scoreboard fields ever disclosed to the tutor.
  assert.ok(result.turnRecords.every((r) => !('dodgeBudgetsRemaining' in r.disclosure)));
  assert.ok(result.turnRecords.every((r) => !('score' in r.disclosure)));
});

test('turns override shortens the episode (smoke geometry)', async () => {
  const config = loadGameConfig(CONFIG_PATH);
  const result = await runEpisode({
    config,
    arm: 'A1',
    episodeId: 'dry-short',
    agents: makeScriptedAgents(config),
    overrides: { rules: { max_turns: 6 } },
  });
  assert.equal(result.summary.turns, 6);
  assert.equal(result.summary.demonstrated, 0); // attrition incomplete by design
  assert.equal(result.summary.totalDodgesCharged, 3);
});
