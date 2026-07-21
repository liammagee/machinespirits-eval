// Program-2 Phase 5c — cross-world transfer analysis
// (PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md §5-§6).
//
// Reads the 5c root ONLY (10 committee-v2 + 8 fresh world_027 controls) —
// no pooling with Phase 5/5b roots: those are Marrick dialogues and
// cross-world pooling is meaningless (prereg §4). Extraction inherited from
// analyze-program2-live-pilot-5b.mjs. Bootstrap: dialogue-cluster,
// profile-stratified, two-sample, 5,000 draws, seed 20260721. E1c PASS =
// 95% CI > 0.
//
// New here: the costume-leak descriptive metric (prereg §5). Both world
// lexicons are derived with the deriveWorldEvidenceLexicon rule (verbatim
// from scripts/program2-cue-sensitivity.mjs, frozen at aa986de7: camel-case
// segments of premise-fact argument constants, minus secret/mirror actor
// constants). Leak set = Marrick lexicon − world_027 lexicon − the frozen
// six. Counted in mini-authored delivered text at committee moments
// (composed → protected span; fallback_* → delivered fallback text;
// frontier_mini_unavailable excluded), with the same count over control-arm
// delivered turns at warrant moments as the plain-English base rate.
//
// Usage: node scripts/analyze-program2-live-pilot-5c.mjs [<5c-root>]
//   [--marrick-world <yaml>] [--transfer-world <yaml>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT_5C = path.resolve(positional[0] || path.join(REPO_ROOT, 'exports/program2-live-pilot-5c'));
const flagOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const MARRICK_WORLD = path.resolve(
  flagOf('--marrick-world', path.join(REPO_ROOT, 'config/drama-derivation/world-005-marrick.yaml')),
);
const TRANSFER_WORLD = path.resolve(
  flagOf('--transfer-world', path.join(REPO_ROOT, 'config/drama-derivation/world-027-gazette-recall.yaml')),
);
const JSON_OUT = flagOf('--json', null);

const integrityPath = path.join(REPO_ROOT, 'services/tutorStubEvalIntegrity.js');
const { summarizeTutorStubFixedHorizon } = await import(pathToFileURL(integrityPath).href);

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- frozen constants (5c prereg §4-§5) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = 20260721;
const PRIMARY_HORIZON = 16;
const PROFILES = ['proof_skipper', 'affective_resistant'];
const PRIMARY_TRIGGER = 'warrant_skip';
const DENSITY_MIN_COMMITTEE = 15;
const COVERAGE_MARGIN = 0.05;
const SAFETY_MARGIN = 0.1;
const FROZEN_SIX = ['evidence', 'item', 'test', 'record', 'fact', 'rule'];
const COMPONENT_KEYS = ['exactly_one_question', 'warrant_cue', 'no_new_premise', 'guards_passed'];
// Prereg §5: generic-English words reported apart from unmistakable costume.
const UNMISTAKABLE_COSTUME = new Set([
  'shilling',
  'graver',
  'burin',
  'crucible',
  'dross',
  'serif',
  'weir',
  'mint',
  'notched',
  'silver',
]);

// Verbatim rule from scripts/program2-cue-sensitivity.mjs (frozen aa986de7).
function camelSegments(term) {
  return String(term)
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/u)
    .filter((s) => s.length >= 3);
}

function deriveWorldEvidenceLexicon(worldPath) {
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

function wordRegex(word) {
  return new RegExp(`\\b${word}(?:'?s|es)?\\b`, 'giu');
}

function loadSealed(root, planJobsFilter) {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'launch-plan.json'), 'utf8')).plan;
  const rows = [];
  for (const job of plan.jobs) {
    if (planJobsFilter && !planJobsFilter(job)) continue;
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
    const turnRecords = [];
    const verdicts = [];
    const moments = [];
    const tutorTextByTurn = new Map();
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'turn_complete' && event.turnRecord) {
        turnRecords.push(event.turnRecord);
        tutorTextByTurn.set(
          Number(event.turnRecord.turn ?? tutorTextByTurn.size + 1),
          String(event.turnRecord.tutor || ''),
        );
      } else if (event.type === 'point_of_action_compliance' && event.compliance?.trigger === PRIMARY_TRIGGER) {
        verdicts.push(event.compliance);
      } else if (event.type === 'program2_committee_moment' && event.moment) {
        moments.push({ turn: event.turn, ...event.moment });
      }
      if (event.type === 'point_of_action_compliance' && event.compliance?.detector_version) {
        if (event.compliance.detector_version !== DETECTOR_VERSION)
          throw new Error(`${job.id}: detector ${event.compliance.detector_version}`);
      }
    }
    const fixedHorizon = summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon: PRIMARY_HORIZON });
    rows.push({
      job,
      warrant: { opp: verdicts.length, comp: verdicts.filter((v) => v.compliant === true).length },
      verdicts,
      moments,
      tutorTextByTurn,
      fixedHorizon,
      fallbackResolutions: moments.filter((m) => m.fallback?.resolution).map((m) => m.fallback.resolution),
    });
  }
  return rows;
}

function pooledRate(rows) {
  const opp = rows.reduce((s, d) => s + d.warrant.opp, 0);
  const comp = rows.reduce((s, d) => s + d.warrant.comp, 0);
  return { opp, comp, rate: opp > 0 ? comp / opp : null };
}
function meanCoverage(rows) {
  const values = rows.map((d) => d.fixedHorizon.coverageAtHorizon).filter((v) => v !== null && v !== undefined);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
function safetyRate(rows) {
  return rows.length ? rows.filter((d) => d.fixedHorizon.hardSafetyPassed).length / rows.length : null;
}
function componentRates(rows) {
  const out = {};
  for (const key of COMPONENT_KEYS) {
    let seen = 0;
    let passed = 0;
    for (const d of rows) {
      for (const v of d.verdicts) {
        if (v.components && key in v.components) {
          seen += 1;
          if (v.components[key]) passed += 1;
        }
      }
    }
    out[key] = seen ? passed / seen : null;
  }
  return out;
}

const committee = loadSealed(ROOT_5C, (job) => job.arm === 'committee');
const controls = loadSealed(ROOT_5C, (job) => job.arm === 'silent_control');

function bootstrap() {
  const random = mulberry32(BOOT_SEED);
  const strata = (rows) => PROFILES.map((p) => rows.filter((d) => d.job.profile === p));
  const committeeStrata = strata(committee);
  const controlStrata = strata(controls);
  const sample = (strataRows) => {
    const picked = [];
    for (const rows of strataRows) {
      for (let k = 0; k < rows.length; k += 1) picked.push(rows[Math.floor(random() * rows.length)]);
    }
    return picked;
  };
  const e1Draws = [];
  const coverageDraws = [];
  for (let i = 0; i < BOOT_DRAWS; i += 1) {
    const committeePick = sample(committeeStrata);
    const controlPick = sample(controlStrata);
    const a = pooledRate(committeePick).rate;
    const b = pooledRate(controlPick).rate;
    e1Draws.push(a !== null && b !== null ? a - b : null);
    const ca = meanCoverage(committeePick);
    const cb = meanCoverage(controlPick);
    coverageDraws.push(ca !== null && cb !== null ? ca - cb : null);
  }
  const ci = (draws) => {
    const valid = draws.filter((d) => d !== null).sort((a, b) => a - b);
    if (!valid.length) return null;
    const q = (p) => valid[Math.min(valid.length - 1, Math.max(0, Math.floor(p * valid.length)))];
    return { draws: valid.length, ci95: [q(0.025), q(0.975)] };
  };
  return { e1: ci(e1Draws), coverage: ci(coverageDraws) };
}

// ---- costume leak (descriptive; prereg §5) ----
function miniAuthoredDeliveredText(moment) {
  if (!moment.source || moment.source === 'frontier_mini_unavailable') return null;
  if (moment.source === 'composed') return moment.span || null;
  if (moment.source.startsWith('fallback')) return moment.deliveredFallbackText ?? moment.miniText ?? null;
  return null;
}

function countLeaks(units, leakWords) {
  const perWord = {};
  const examples = [];
  let unitsWithLeak = 0;
  let totalOccurrences = 0;
  let totalWords = 0;
  for (const unit of units) {
    const text = unit.text || '';
    totalWords += text.split(/\s+/u).filter(Boolean).length;
    let unitHit = false;
    for (const word of leakWords) {
      const matches = [...text.matchAll(wordRegex(word))];
      if (!matches.length) continue;
      unitHit = true;
      totalOccurrences += matches.length;
      perWord[word] = (perWord[word] || 0) + matches.length;
      if (examples.length < 20) {
        const at = matches[0].index || 0;
        examples.push({
          word,
          job: unit.job,
          turn: unit.turn,
          snippet: text
            .slice(Math.max(0, at - 60), at + 60)
            .replace(/\s+/gu, ' ')
            .trim(),
        });
      }
    }
    if (unitHit) unitsWithLeak += 1;
  }
  const costumeOccurrences = Object.entries(perWord)
    .filter(([w]) => UNMISTAKABLE_COSTUME.has(w))
    .reduce((s, [, n]) => s + n, 0);
  return {
    units: units.length,
    unitsWithLeak,
    unitLeakRate: units.length ? unitsWithLeak / units.length : null,
    totalOccurrences,
    occurrencesPer1kWords: totalWords ? (totalOccurrences / totalWords) * 1000 : null,
    unmistakableCostumeOccurrences: costumeOccurrences,
    totalWords,
    perWord,
    examples,
  };
}

const marrickLexicon = deriveWorldEvidenceLexicon(MARRICK_WORLD);
const transferLexicon = deriveWorldEvidenceLexicon(TRANSFER_WORLD);
const transferSet = new Set(transferLexicon.lexicon);
const frozenSet = new Set(FROZEN_SIX);
const leakWords = marrickLexicon.lexicon.filter((w) => !transferSet.has(w) && !frozenSet.has(w));

const committeeUnits = [];
for (const d of committee) {
  for (const m of d.moments) {
    const text = miniAuthoredDeliveredText(m);
    if (text) committeeUnits.push({ job: d.job.id, turn: m.turn, text });
  }
}
const controlUnits = [];
for (const d of controls) {
  for (const v of d.verdicts) {
    const text = d.tutorTextByTurn.get(Number(v.turn)) || '';
    if (text) controlUnits.push({ job: d.job.id, turn: v.turn, text });
  }
}
const costumeLeak = {
  leakWords,
  committee: countLeaks(committeeUnits, leakWords),
  controlBaseRate: countLeaks(controlUnits, leakWords),
};

// ---- verdicts ----
const committeeRate = pooledRate(committee);
const controlRate = pooledRate(controls);
const boot = bootstrap();
const e1Diff = committeeRate.rate !== null && controlRate.rate !== null ? committeeRate.rate - controlRate.rate : null;
const densityPass =
  committeeRate.opp >= DENSITY_MIN_COMMITTEE &&
  committee.filter((d) => d.job.profile === 'proof_skipper').some((d) => d.warrant.opp > 0);
const e1Pass = densityPass && boot.e1 !== null && boot.e1.ci95[0] > 0;
const coverageGuardrail =
  meanCoverage(committee) !== null &&
  meanCoverage(controls) !== null &&
  meanCoverage(committee) >= meanCoverage(controls) - COVERAGE_MARGIN;
const safetyGuardrail =
  safetyRate(committee) !== null &&
  safetyRate(controls) !== null &&
  safetyRate(committee) >= safetyRate(controls) - SAFETY_MARGIN;
const fallbackTally = {};
for (const d of committee) for (const r of d.fallbackResolutions) fallbackTally[r] = (fallbackTally[r] || 0) + 1;
const sourceTally = {};
for (const d of committee)
  for (const m of d.moments) sourceTally[m.source || 'null'] = (sourceTally[m.source || 'null'] || 0) + 1;

const artifact = {
  schema: 'machinespirits.program2.phase5c-analysis.v1',
  generatedAt: new Date().toISOString(),
  preregistration: 'PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md',
  world: transferLexicon.worldId,
  bootstrap: { draws: BOOT_DRAWS, seed: BOOT_SEED },
  sealed: { committee: committee.length, controls: controls.length },
  e1c: {
    committee: committeeRate,
    control: controlRate,
    diff: e1Diff,
    bootstrap: boot.e1,
    densityPass,
    pass: e1Pass,
  },
  components: { committee: componentRates(committee), control: componentRates(controls) },
  guardrails: {
    coverage: {
      committee: meanCoverage(committee),
      control: meanCoverage(controls),
      bootstrap: boot.coverage,
      pass: coverageGuardrail,
    },
    safety: { committee: safetyRate(committee), control: safetyRate(controls), pass: safetyGuardrail },
  },
  fallbackTally,
  sourceTally,
  costumeLeak,
  lexicons: { marrick: marrickLexicon, transfer: transferLexicon },
  references: { phase5bCommitteeV2: '0.386 (32/83) on world_005_marrick', phase5bPooledControl: '0.150 (18/120)' },
};

function fmt(v, digits = 3) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits);
}
console.log(
  `[phase5c] world ${transferLexicon.worldId}: committee ${committeeRate.comp}/${committeeRate.opp} (${fmt(committeeRate.rate)}) vs control ${controlRate.comp}/${controlRate.opp} (${fmt(controlRate.rate)}) [fresh controls only, n=${controls.length} dialogues — no pooling]`,
);
console.log(
  `[phase5c] E1c diff ${fmt(e1Diff)} CI ${boot.e1 ? `[${fmt(boot.e1.ci95[0])}, ${fmt(boot.e1.ci95[1])}]` : 'n/a'} -> ${e1Pass ? 'PASS' : 'no'}; density ${densityPass ? 'PASS' : 'FAIL'} (${committeeRate.opp} committee opportunities)`,
);
console.log(
  `[phase5c] coverage ${fmt(meanCoverage(committee))} vs ${fmt(meanCoverage(controls))} (${coverageGuardrail ? 'PASS' : 'FAIL'}); safety ${fmt(safetyRate(committee), 2)} vs ${fmt(safetyRate(controls), 2)} (${safetyGuardrail ? 'PASS' : 'FAIL'})`,
);
console.log(
  `[phase5c] components committee ${JSON.stringify(componentRates(committee))} | control ${JSON.stringify(componentRates(controls))}`,
);
console.log(
  `[phase5c] sources: ${JSON.stringify(sourceTally)}; fallback resolutions: ${JSON.stringify(fallbackTally)}`,
);
console.log(
  `[phase5c] costume leak (${leakWords.length} Marrick-only words): committee ${costumeLeak.committee.totalOccurrences} occurrences over ${costumeLeak.committee.units} mini-authored units (${fmt(costumeLeak.committee.occurrencesPer1kWords, 1)}/1k words, ${costumeLeak.committee.unmistakableCostumeOccurrences} unmistakable-costume) vs control base rate ${costumeLeak.controlBaseRate.totalOccurrences} over ${costumeLeak.controlBaseRate.units} turns (${fmt(costumeLeak.controlBaseRate.occurrencesPer1kWords, 1)}/1k words, ${costumeLeak.controlBaseRate.unmistakableCostumeOccurrences} unmistakable-costume)`,
);
if (costumeLeak.committee.totalOccurrences) {
  console.log(`[phase5c] committee per-word leaks: ${JSON.stringify(costumeLeak.committee.perWord)}`);
  for (const ex of costumeLeak.committee.examples.slice(0, 8)) {
    console.log(`  LEAK "${ex.word}" ${ex.job} t${ex.turn}: ...${ex.snippet}...`);
  }
}
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[phase5c] wrote ${JSON_OUT}`);
}
