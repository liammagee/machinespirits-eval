// Guard against authored world content that no runner reads.
//
// World files may declare `motivation.learner` — a typed first-order end, a
// mirror pull level, and a disposition (overreach, arc). It parses, it passes
// every world-quality gate, and it reads in the YAML as though it drives the
// learner. On the tutor-stub path it drives nothing: the only consumer is
// buildLearnerCharacterArcView, gated behind the engine's `characterArc`
// option, which is passed by scripts/run-derivation-loop.js alone.
//
// The tutor-stub outcome pilot therefore runs a motivation-declaring world with
// a stock learner profile that can flatly contradict the authored voice. That
// is how world-032's misconception learner conceded at turn 2 of its first
// gate run (2026-07-30) while the world file said it bends facts until they
// fit. The tests below pin the reach so the gap stays visible and cannot widen
// silently: add motivation to another world and the count fails; wire the
// consumer into the tutor-stub path and the reach assertion fails. Either way
// the next person has to come here and say which it was.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

// Raise deliberately, and only alongside a note saying whether the new world's
// authored motivation actually reaches the runner that world is run by.
// 20th world: world_033_alder_row_redoubt keeps its base world's motivation
// block for the minimal pair; on the tutor-stub outcome path it is UNREAD, and
// the authored voice is carried by `--learner-profile contradiction_keeper`.
const WORLDS_DECLARING_LEARNER_MOTIVATION = 20;

function allWorlds() {
  return fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/u.test(file))
    .map((file) => loadWorld(path.join(WORLD_DIR, file)));
}

test('the count of worlds declaring authored learner motivation is pinned', () => {
  const declaring = allWorlds().filter((world) => world.motivation?.learner);
  assert.equal(
    declaring.length,
    WORLDS_DECLARING_LEARNER_MOTIVATION,
    `${declaring.length} worlds declare motivation.learner, pinned at ${WORLDS_DECLARING_LEARNER_MOTIVATION}. ` +
      'Raising this is fine, but say in the same commit whether the new world runs on a path that reads it.',
  );
});

test('the authored-motivation consumer is reachable only from the derivation loop', () => {
  const engine = fs.readFileSync(path.join(ROOT, 'services', 'dramaticDerivation', 'engine.js'), 'utf8');
  assert.match(
    engine,
    /opts\.characterArc \? buildLearnerCharacterArcView\(/u,
    'the learner character-arc view is no longer gated on opts.characterArc — re-check which runners now read authored motivation',
  );

  const callers = fs
    .readdirSync(path.join(ROOT, 'scripts'))
    .filter((file) => file.endsWith('.js'))
    .filter((file) => /characterArc|--character-arc/u.test(fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8')));
  assert.deepEqual(
    callers.sort(),
    ['run-derivation-loop.js', 'score-character-development.js'],
    'the set of scripts touching the character-arc option changed; if the tutor-stub path now passes it, update this test and the note above it',
  );
});

test('the tutor-stub outcome pilot does not pass the authored motivation through', () => {
  const pilot = fs.readFileSync(path.join(ROOT, 'scripts', 'run-contract-outcome-pilot.js'), 'utf8');
  assert.ok(
    !/--character-arc/u.test(pilot),
    'the outcome pilot now passes --character-arc; authored learner motivation reaches the learner, so the gate protocol note in ' +
      'workplan/items/misconception-world-outcome-gate.md is stale and the stock-profile caveat should be lifted',
  );
  // The learner's private brief comes from the stock profile registry, not the
  // world. This is the substitution that outranks the world's own voice.
  assert.match(
    pilot,
    /learnerProfile: 'diligent'/u,
    'the pilot default learner profile moved; re-read the gate protocol',
  );
});
