#!/usr/bin/env node
/**
 * Check that a boredom proof-DAG registration's worlds can actually move its
 * endpoints inside its own turn budget.
 *
 * The v4 confirmation returned a null on a window in which neither endpoint
 * could move. The release schedule of each world and the turn budget of the
 * registration live in different files, are written in the same units, and
 * nothing compared them. This script is that comparison.
 *
 * Pure computation. No model calls, no database, no writes.
 *
 *   node scripts/verify-boredom-v5-world-window.js
 *   node scripts/verify-boredom-v5-world-window.js --registration <path>
 *   node scripts/verify-boredom-v5-world-window.js --json
 *
 * Exit code 0 when every registered world clears the rule, 1 when any fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REGISTRATION = path.join(
  ROOT,
  'config',
  'tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
);
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

function parseArgs(argv) {
  const args = { registration: DEFAULT_REGISTRATION, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--registration') args.registration = path.resolve(argv[(i += 1)] || '');
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

/** `world_026_skyway_bakery` is how the registration names `world-026-skyway-bakery.yaml`. */
function worldFileName(registeredId) {
  return `${String(registeredId).replace(/_/gu, '-')}.yaml`;
}

/**
 * The shortest authored proof path, which is the one a learner can finish
 * soonest and so the one the turn budget has to accommodate. Ties break on the
 * path that completes earliest.
 */
function shortestProofPath(world) {
  const releaseTurnByPremise = new Map((world.releaseSchedule || []).map((entry) => [entry.premise, entry.turn]));
  const paths = (world.proofPaths || []).map((proofPath, index) => {
    const premiseIds = Array.isArray(proofPath?.premises) ? proofPath.premises : [];
    const releaseTurns = premiseIds.map((id) => releaseTurnByPremise.get(id)).filter(Number.isFinite);
    return {
      id: proofPath?.id || proofPath?.name || `path_${index + 1}`,
      premiseCount: premiseIds.length,
      releaseTurns: [...new Set(releaseTurns)].sort((a, b) => a - b),
      completeByTurn:
        releaseTurns.length === premiseIds.length && releaseTurns.length ? Math.max(...releaseTurns) : null,
    };
  });
  return paths.sort(
    (a, b) => a.premiseCount - b.premiseCount || (a.completeByTurn ?? Infinity) - (b.completeByTurn ?? Infinity),
  )[0];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'verify-boredom-v5-world-window — do the registered worlds open early enough for this design?\n\n' +
        '  --registration <path>  registration to check (default: the v5 file)\n' +
        '  --json                 machine-readable output\n',
    );
    return 0;
  }
  if (!fs.existsSync(args.registration)) {
    process.stderr.write(`no registration at ${args.registration}\n`);
    return 1;
  }
  const registration = JSON.parse(fs.readFileSync(args.registration, 'utf8'));
  const worlds = registration?.design?.worlds || [];
  const maximumTriggerTurn = Number(registration?.design?.freshPrefixGeneration?.maximumTriggerTurn);
  const postTriggerLearnerTurns = Number(registration?.design?.treatment?.postTriggerLearnerTurns);
  const required = Number(registration?.design?.worldSelection?.onPathPremisesUsableAtEarliestEndTurn ?? 2);

  if (!worlds.length || !Number.isFinite(maximumTriggerTurn) || !Number.isFinite(postTriggerLearnerTurns)) {
    process.stderr.write('registration does not carry design.worlds, maximumTriggerTurn and postTriggerLearnerTurns\n');
    return 1;
  }

  // The smallest trigger turn is 1, so the earliest a dialogue can end is
  // 1 + postTriggerLearnerTurns. That is the worst case a world has to clear.
  const earliestEndTurn = 1 + postTriggerLearnerTurns;
  const latestEndTurn = maximumTriggerTurn + postTriggerLearnerTurns;

  const rows = [];
  for (const registeredId of worlds) {
    const file = path.join(WORLD_DIR, worldFileName(registeredId));
    if (!fs.existsSync(file)) {
      rows.push({ world: registeredId, ok: false, why: `no world file at ${path.relative(ROOT, file)}` });
      continue;
    }
    const world = loadWorld(file);
    const proofPath = shortestProofPath(world);
    if (!proofPath) {
      rows.push({ world: registeredId, ok: false, why: 'world authors no proof path' });
      continue;
    }
    // Usable means released strictly before the last turn, so the learner has
    // at least that turn in which to use it.
    const usable = proofPath.releaseTurns.filter((turn) => turn < earliestEndTurn);
    const turnCap = Number(world.turnCap);
    const capOk = !Number.isFinite(turnCap) || turnCap >= latestEndTurn;
    const ok = usable.length >= required && capOk;
    rows.push({
      world: registeredId,
      ok,
      shortestPathPremises: proofPath.premiseCount,
      onPathReleaseTurns: proofPath.releaseTurns,
      usableAtEarliestEndTurn: usable.length,
      turnCap: Number.isFinite(turnCap) ? turnCap : null,
      ...(ok
        ? {}
        : {
            why: !capOk
              ? `turn cap ${turnCap} is below the latest possible end turn ${latestEndTurn}`
              : `only ${usable.length} path premise(s) are usable by turn ${earliestEndTurn}, the rule needs ${required}`,
          }),
    });
  }

  const failed = rows.filter((row) => !row.ok);
  const result = {
    registration: path.relative(ROOT, args.registration),
    maximumTriggerTurn,
    postTriggerLearnerTurns,
    earliestEndTurn,
    latestEndTurn,
    requiredUsablePathPremises: required,
    worlds: rows,
    pass: failed.length === 0,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return failed.length ? 1 : 0;
  }

  process.stdout.write(`registration      ${result.registration}\n`);
  process.stdout.write(`trigger turns     1 to ${maximumTriggerTurn}\n`);
  process.stdout.write(`turns after       ${postTriggerLearnerTurns}\n`);
  process.stdout.write(
    `dialogue ends     turn ${earliestEndTurn} at the earliest, turn ${latestEndTurn} at the latest\n`,
  );
  process.stdout.write(
    `rule              at least ${required} path premises released before turn ${earliestEndTurn}\n\n`,
  );
  for (const row of rows) {
    const mark = row.ok ? 'PASS' : 'FAIL';
    const detail = row.ok
      ? `path of ${row.shortestPathPremises} opens at ${JSON.stringify(row.onPathReleaseTurns)}, ${row.usableAtEarliestEndTurn} usable, cap ${row.turnCap}`
      : row.why;
    process.stdout.write(`${mark}  ${String(row.world).padEnd(30)} ${detail}\n`);
  }
  process.stdout.write(
    failed.length
      ? `\n${failed.length} of ${rows.length} worlds cannot move the endpoints inside this turn budget.\n`
      : `\nAll ${rows.length} worlds clear the rule.\n`,
  );
  return failed.length ? 1 : 0;
}

process.exitCode = main();
