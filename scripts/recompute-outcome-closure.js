#!/usr/bin/env node
/**
 * Offline closure recompute for an outcome-pilot run, required by the pilot
 * gate in workplan/items/tutor-contract-outcome-prereg.md.
 *
 * The live engine can only miss a closure in one direction the hand-audit
 * cares about: the record entails the secret, the learner states the verdict,
 * and the assertion matcher does not see it. For those dialogues — entailed
 * but never closed — this script replays the (pure) authored-claim matcher
 * over the asserted part of every recorded learner line against the worlds'
 * current recognition patterns. No model call, no new spend, no change to the
 * recorded run: it writes a corrected table beside the report.
 *
 * The corrected table prints the matched text, not the whole learner turn, so
 * that a reader can check each correction against the sentence the matcher
 * actually read. The first pass of this script closed two dialogues on a hedge
 * and on a denial; those quotes are how that was caught.
 *
 * Dialogues the engine closed stay closed (the hand-audit spot-checked them
 * as genuine); dialogues that never reached entailment cannot close by
 * assertion and stay open.
 *
 *   node scripts/recompute-outcome-closure.js --run exports/tutor-stub-outcome/pilot-1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import { matchAuthoredRecognitionClaim } from '../services/dramaticDerivation/answerSurface.js';
import { tutorStubAssertedClaimText } from '../services/tutorStubConclusionAssertion.js';
import { tutorStubOutcomeRowKind } from '../services/tutorStubOutcomeRows.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { run: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = path.resolve(ROOT, argv[++i]);
    else throw new Error(`unknown flag ${argv[i]}`);
  }
  if (!args.run) throw new Error('need --run <outcome run dir>');
  return args;
}

function worldSecret(worldId) {
  const file = path.join(
    ROOT,
    'config',
    'drama-derivation',
    `${worldId.replace(/_/gu, '-').replace(/^world-/u, 'world-')}.yaml`,
  );
  return YAML.parse(fs.readFileSync(file, 'utf8')).secret;
}

function bandVerdict(rate) {
  if (rate === null) return 'unmeasured';
  if (rate < 0.2) return 'BELOW BAND';
  if (rate > 0.8) return 'ABOVE BAND';
  return 'in band';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = fs
    .readFileSync(path.join(args.run, 'results.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    // Same rule the runner's report uses: a dialogue the harness killed is not
    // one the tutor failed to close, so it stays out of the corrected table.
    .filter((row) => tutorStubOutcomeRowKind(row) === 'complete');

  const corrected = rows.map((row) => {
    const engineClosed = row.closure?.grounded === true;
    if (engineClosed) return { ...row, correctedClosed: true, correction: null };
    if (row.assessment?.finalSecretEntailed !== true) return { ...row, correctedClosed: false, correction: null };
    const secret = worldSecret(row.world);
    for (const turn of row.turns || []) {
      const asserted = tutorStubAssertedClaimText(turn.learner);
      const claim = matchAuthoredRecognitionClaim(asserted, {
        surfaces: secret?.recognition_surfaces,
        patterns: secret?.recognition_patterns,
      });
      if (claim) {
        return {
          ...row,
          correctedClosed: true,
          correction: {
            turn: turn.index,
            via: claim.kind === 'surface' ? claim.matchedSurface : claim.matchedPattern,
            assertedText: asserted.slice(0, 300),
          },
        };
      }
    }
    return { ...row, correctedClosed: false, correction: null };
  });

  const worlds = [...new Set(corrected.map((row) => row.world))];
  const lines = [
    '# Corrected closure table — offline recompute',
    '',
    `Run: \`${path.relative(ROOT, args.run)}\` · matcher replayed over recorded learner lines with the current world patterns`,
    '',
    '| World | Dialogues | Engine closed | Corrected closed | Corrected rate | Band |',
    '|---|---|---|---|---|---|',
  ];
  for (const world of worlds) {
    const ok = corrected.filter((row) => row.world === world);
    const engine = ok.filter((row) => row.closure?.grounded === true).length;
    const closed = ok.filter((row) => row.correctedClosed).length;
    const rate = ok.length ? closed / ok.length : null;
    lines.push(
      `| ${world} | ${ok.length} | ${engine} | ${closed} | ${rate === null ? '—' : `${Math.round(rate * 100)}%`} | ${bandVerdict(rate)} |`,
    );
  }
  const corrections = corrected.filter((row) => row.correction);
  lines.push('', `${corrections.length} dialogue(s) corrected by the recompute:`, '');
  for (const row of corrections) {
    lines.push(
      `- ${row.world} #${row.k}, turn ${row.correction.turn} via \`${row.correction.via}\`, matched on: “${row.correction.assertedText}”`,
    );
  }
  lines.push('');

  const outPath = path.join(args.run, 'closure-recompute.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  fs.writeFileSync(
    path.join(args.run, 'closure-recompute.json'),
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.outcome-closure-recompute.v1',
        run: path.relative(ROOT, args.run),
        rows: corrected.map((row) => ({
          world: row.world,
          k: row.k,
          engineClosed: row.closure?.grounded === true,
          correctedClosed: row.correctedClosed,
          correction: row.correction,
        })),
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`${lines.join('\n')}\nwritten to ${path.relative(ROOT, outPath)}\n`);
}

main();
