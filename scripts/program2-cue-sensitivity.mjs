// Program-2 Phase 5 — cue-lexicon sensitivity rescore (exploratory tier).
//
// Question (user, 2026-07-20): does the scenario's own language contain
// adequate proxies for the six frozen warrant-cue words — and how much of
// the live E1 contrast is pedagogy versus lexicon blindness?
//
// Discipline: the relaxed lexicon is derived MECHANICALLY from the world
// definition only (never from any arm's outputs): the camel-case segments of
// every premise-fact argument constant in the world's proof DAG, minus
// person constants (the actor arguments of the secret and mirror facts).
// This file and the derived lexicon are committed BEFORE the pilot
// completes; the frozen E1 verdict is never replaced — this rescoring is
// reported beside it, labeled exploratory. Both arms are rescored
// symmetrically; only the warrant_cue component is recomputed (question
// count, premise release, and guard components are read from the sealed
// frozen compliance events unchanged).
//
// Usage:
//   node scripts/program2-cue-sensitivity.mjs \
//     [--pilot-root <exports/program2-live-pilot>] \
//     [--world <world-005-marrick.yaml>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'js-yaml';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

const { values: args } = parseArgs({
  options: {
    'pilot-root': {
      type: 'string',
      default: path.resolve(REPO_ROOT, '../ms-phase5-pinned/exports/program2-live-pilot'),
    },
    world: {
      type: 'string',
      default: path.resolve(REPO_ROOT, '../ms-phase5-pinned/config/drama-derivation/world-005-marrick.yaml'),
    },
    json: { type: 'string' },
  },
});

// Frozen six (verbatim from services/tutorStubPointOfActionCoaching.js).
const FROZEN_CUE_RE = /\b(?:evidence|item|test|record|fact|rule)\b/iu;

function camelSegments(term) {
  return String(term)
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/u)
    .filter((s) => s.length >= 3);
}

export function deriveWorldEvidenceLexicon(worldPath) {
  const world = yaml.load(fs.readFileSync(worldPath, 'utf8'));
  const persons = new Set();
  for (const src of [world.secret, world.mirror]) {
    const fact = src?.fact;
    if (Array.isArray(fact) && fact.length) persons.add(String(fact.at(-1)));
  }
  const constants = new Set();
  for (const premise of world.premises || []) {
    const fact = premise?.fact;
    if (!Array.isArray(fact)) continue;
    for (const arg of fact.slice(1)) {
      if (typeof arg === 'string' && !arg.startsWith('?') && !persons.has(arg)) constants.add(arg);
    }
  }
  const words = new Set();
  for (const constant of constants) for (const seg of camelSegments(constant)) words.add(seg);
  return {
    worldId: world.id || path.basename(worldPath),
    rule: 'camel-case segments (len>=3) of premise-fact argument constants, minus secret/mirror actor constants',
    personsExcluded: [...persons].sort(),
    constants: [...constants].sort(),
    lexicon: [...words].sort(),
  };
}

function relaxedCueRe(lexicon) {
  const alts = lexicon.map((w) => `${w}(?:'?s|es)?`).join('|');
  return new RegExp(`\\b(?:${alts})\\b`, 'iu');
}

function rescoreRoot(root, relaxedRe) {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'launch-plan.json'), 'utf8')).plan;
  const perArm = {};
  const flips = [];
  for (const job of plan.jobs) {
    const dir = path.join(root, 'traces', job.id);
    if (!fs.existsSync(dir)) continue;
    const sealedFile = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f))
      .find((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return text.includes('"type":"run_end"') || text.includes('"type": "run_end"');
      });
    if (!sealedFile) continue;
    const tutorTextByTurn = new Map();
    const verdicts = [];
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'turn_complete' && event.turnRecord) {
        tutorTextByTurn.set(
          Number(event.turnRecord.turn ?? tutorTextByTurn.size + 1),
          String(event.turnRecord.tutor || ''),
        );
      } else if (event.type === 'point_of_action_compliance' && event.compliance?.trigger === 'warrant_skip') {
        verdicts.push(event.compliance);
      }
    }
    const arm = job.arm;
    perArm[arm] ||= { opp: 0, frozenComp: 0, relaxedComp: 0, cueOnlyFlips: 0 };
    for (const verdict of verdicts) {
      const text = tutorTextByTurn.get(Number(verdict.turn)) || '';
      const components = verdict.components || {};
      const relaxedCue = FROZEN_CUE_RE.test(text) || relaxedRe.test(text);
      const relaxedCompliant = Boolean(
        components.exactly_one_question && relaxedCue && components.no_new_premise && components.guards_passed,
      );
      perArm[arm].opp += 1;
      if (verdict.compliant === true) perArm[arm].frozenComp += 1;
      if (relaxedCompliant) perArm[arm].relaxedComp += 1;
      if (relaxedCompliant && verdict.compliant !== true) {
        perArm[arm].cueOnlyFlips += 1;
        const question = (text.match(/[^.!?\n]+\?/gu) || []).map((s) => s.trim());
        flips.push({ job: job.id, arm, turn: verdict.turn, question: question.join(' ').slice(0, 220) });
      }
    }
  }
  for (const cell of Object.values(perArm)) {
    cell.frozenRate = cell.opp ? cell.frozenComp / cell.opp : null;
    cell.relaxedRate = cell.opp ? cell.relaxedComp / cell.opp : null;
  }
  return { perArm, flips };
}

const derivation = deriveWorldEvidenceLexicon(args.world);
const relaxedRe = relaxedCueRe(derivation.lexicon);
const result = rescoreRoot(path.resolve(args['pilot-root']), relaxedRe);

const artifact = {
  schema: 'machinespirits.program2.cue-sensitivity.v1',
  tier: 'exploratory — never replaces the frozen E1 verdict',
  generatedAt: new Date().toISOString(),
  derivation,
  perArm: result.perArm,
  flips: result.flips,
};

console.log(
  `[cue-sensitivity] world ${derivation.worldId}; lexicon (${derivation.lexicon.length}): ${derivation.lexicon.join(', ')}`,
);
for (const [arm, cell] of Object.entries(result.perArm)) {
  console.log(
    `  ${arm}: frozen ${cell.frozenComp}/${cell.opp} (${cell.frozenRate?.toFixed(3)}) -> relaxed ${cell.relaxedComp}/${cell.opp} (${cell.relaxedRate?.toFixed(3)}), +${cell.cueOnlyFlips} cue-only flips`,
  );
}
const arms = Object.keys(result.perArm);
if (arms.length === 2) {
  const [a, b] = ['committee', 'silent_control'];
  if (result.perArm[a] && result.perArm[b]) {
    console.log(
      `  E1 frozen diff ${(result.perArm[a].frozenRate - result.perArm[b].frozenRate).toFixed(3)} | relaxed diff ${(result.perArm[a].relaxedRate - result.perArm[b].relaxedRate).toFixed(3)}`,
    );
  }
}
for (const flip of result.flips.slice(0, 12)) {
  console.log(`  FLIP [${flip.arm}] ${flip.job} t${flip.turn}: ${flip.question}`);
}
if (args.json) {
  fs.writeFileSync(path.resolve(args.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[cue-sensitivity] wrote ${args.json}`);
}
