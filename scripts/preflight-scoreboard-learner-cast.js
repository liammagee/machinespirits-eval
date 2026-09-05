#!/usr/bin/env node
/**
 * Zero-call preflight for the scoreboard crossed run (Step 2 of
 * notes/2026-09-04-scoreboard-replay-prompt.md).
 *
 * Builds the extractor records each learner trigger would leave, runs the
 * fixed board reader over them, and checks that every trigger shows on the
 * learner row and that the dialogue reads as the cast shape. Fails closed:
 * exit 1 on any miss. No model is called and nothing is written unless
 * --out is given.
 *
 * Usage:
 *   node scripts/preflight-scoreboard-learner-cast.js
 *   node scripts/preflight-scoreboard-learner-cast.js --worlds world_101_kestrel_signal_lamp,world_102_marigold_archive_box \
 *     --profiles low_agency,overconfident --policies board,board_blind --turns 8 --out <file.json>
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadScoreboardWorld } from '../services/tutorStubScoreboard.js';
import {
  SCOREBOARD_CAST_PROFILES,
  preflightScoreboardLearnerCast,
  renderScoreboardCastReport,
} from '../services/tutorStubScoreboardLearnerCast.js';

const DEFAULT_WORLDS = ['world_101_kestrel_signal_lamp', 'world_102_marigold_archive_box'];

function list(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const { values } = parseArgs({
    options: {
      worlds: { type: 'string' },
      profiles: { type: 'string' },
      policies: { type: 'string' },
      turns: { type: 'string', default: '8' },
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'node scripts/preflight-scoreboard-learner-cast.js [--worlds a,b] [--profiles low_agency,overconfident] [--policies board,board_blind] [--turns 8] [--out file.json] [--json]',
    );
    return 0;
  }
  const rootDir = process.cwd();
  const worlds = list(values.worlds, DEFAULT_WORLDS).map((id) => loadScoreboardWorld(id, { rootDir }));
  const profiles = list(values.profiles, [...SCOREBOARD_CAST_PROFILES]);
  const policies = list(values.policies, ['board', 'board_blind']);
  const turns = Number(values.turns) || 8;
  const preflight = preflightScoreboardLearnerCast({ worlds, profiles, policies, turns });
  const payload = {
    schema: 'machinespirits.tutor-stub.scoreboard-learner-cast-preflight.v1',
    generatedAt: new Date().toISOString(),
    worlds: worlds.map((w) => w.id),
    profiles,
    policies,
    turns,
    ...preflight,
  };
  if (values.out) {
    fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
    fs.writeFileSync(values.out, `${JSON.stringify(payload, null, 2)}\n`);
  }
  if (values.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(renderScoreboardCastReport(preflight));
  return preflight.ok ? 0 : 1;
}

process.exitCode = main();
