// Program-2 Phase 5e / 5f transfer analysis. Phase 5e remains the default;
// the Phase 5f entry point supplies its own frozen schema, world, gates, and
// preregistration while reusing the same extraction and bootstrap machinery.
//
// Reads the selected phase root ONLY (10 committee-v2 + 8 fresh controls) —
// no pooling with earlier-world roots. Extraction is inherited from
// analyze-program2-live-pilot-5b.mjs. Bootstrap: dialogue-cluster,
// profile-stratified, two-sample, 5,000 draws, with the phase-specific frozen
// seed. The primary endpoint passes only when its 95% CI is above zero.
//
// New here: the costume-leak descriptive metric (prereg §5). Both world
// lexicons are derived with the deriveWorldEvidenceLexicon rule (verbatim
// from scripts/program2-cue-sensitivity.mjs, frozen at aa986de7: camel-case
// segments of premise-fact argument constants, minus secret/mirror actor
// constants). Leak set = Marrick lexicon − transfer-world lexicon − the frozen
// six. Counted in mini-authored delivered text at committee moments
// (composed → protected span; fallback_* → delivered fallback text;
// frontier_mini_unavailable excluded), with the same count over control-arm
// delivered turns at warrant moments as the plain-English base rate.
//
// New descriptive endpoint: native frozen-six density in control delivered
// turns at warrant moments, using the same regex as the world selector.
//
// Usage: node scripts/analyze-program2-live-pilot-5e.mjs [<phase-root>]
//   [--analysis-phase 5e|5f] [--marrick-world <yaml>]
//   [--transfer-world <yaml>] [--gate-spec <json>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

import { countProgram2Phase5eFrozenSixUnits } from '../services/program2Phase5eWorldSelection.js';
import { evaluateProgram2LiveFutility } from '../services/program2ExperimentSafety.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const flagOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const VALUE_FLAGS = new Set([
  '--analysis-phase',
  '--marrick-world',
  '--transfer-world',
  '--gate-spec',
  '--json',
]);
const positional = [];
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (VALUE_FLAGS.has(token)) {
    index += 1;
    continue;
  }
  if (!token.startsWith('--')) positional.push(token);
}
const ANALYSIS_PHASE = flagOf('--analysis-phase', '5e');
if (!['5e', '5f'].includes(ANALYSIS_PHASE)) throw new Error('--analysis-phase must be 5e or 5f');
const IS_PHASE5F = ANALYSIS_PHASE === '5f';
const ROOT_5E = path.resolve(
  positional[0] ||
    path.join(REPO_ROOT, IS_PHASE5F ? 'exports/program2-live-pilot-5f' : 'exports/program2-live-pilot-5e-r2'),
);
const MARRICK_WORLD = path.resolve(
  flagOf('--marrick-world', path.join(REPO_ROOT, 'config/drama-derivation/world-005-marrick.yaml')),
);
const TRANSFER_WORLD = path.resolve(
  flagOf(
    '--transfer-world',
    path.join(
      REPO_ROOT,
      'config/drama-derivation',
      IS_PHASE5F ? 'world-031-tideway-makerspace.yaml' : 'world-026-skyway-bakery.yaml',
    ),
  ),
);
const GATE_SPEC_FILE = path.resolve(
  flagOf(
    '--gate-spec',
    path.join(
      REPO_ROOT,
      'config/adaptive-tutor-evidence',
      IS_PHASE5F ? 'program-2-phase5f-gates.json' : 'program-2-phase5e-r2-gates.json',
    ),
  ),
);
const JSON_OUT = flagOf('--json', null);
const GATE_SPEC = JSON.parse(fs.readFileSync(GATE_SPEC_FILE, 'utf8'));
const LAUNCH_PLAN = JSON.parse(fs.readFileSync(path.join(ROOT_5E, 'launch-plan.json'), 'utf8')).plan;
const launchStateFile = path.join(ROOT_5E, 'launch-state.json');
const LAUNCH_STATE = fs.existsSync(launchStateFile)
  ? JSON.parse(fs.readFileSync(launchStateFile, 'utf8'))
  : { jobs: {} };

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

// ---- frozen constants (5e prereg §4-§5) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = IS_PHASE5F ? 20260728 : 20260726;
const PRIMARY_HORIZON = 16;
const PROFILES = ['proof_skipper', 'affective_resistant'];
const PRIMARY_TRIGGER = 'warrant_skip';
const DENSITY_MIN_COMMITTEE = Number(GATE_SPEC.minOpportunitiesPerCell);
const DENSITY_MIN_CONTROL = Number(GATE_SPEC.minOpportunitiesPerCell);
const DENSITY_MIN_PROFILE_CELL = Number(GATE_SPEC.minOpportunitiesPerProfileCell);
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
  const rows = [];
  for (const job of LAUNCH_PLAN.jobs) {
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
      turnRecords,
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

function turnProgressionIssues(turnRecord = {}) {
  return [
    ...(turnRecord?.liveTurnProgressionAudit?.issues || []),
    ...(turnRecord?.tutorGuardAccounting?.attempts || []).flatMap(
      (attempt) => attempt?.audits?.liveTurnProgressionAudit?.issues || [],
    ),
  ];
}

function handoffConflictAnatomy(rows) {
  let questionlessWarrantMoments = 0;
  let questionForbiddenMoments = 0;
  const examples = [];
  for (const row of rows) {
    const turnRecords = new Map(row.turnRecords.map((turn) => [Number(turn.turn), turn]));
    for (const verdict of row.verdicts) {
      if (verdict?.components?.exactly_one_question === true) continue;
      questionlessWarrantMoments += 1;
      const issues = turnProgressionIssues(turnRecords.get(Number(verdict.turn)) || {});
      if (!issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract')) continue;
      questionForbiddenMoments += 1;
      if (examples.length < 12) examples.push({ job: row.job.id, turn: verdict.turn });
    }
  }
  return {
    scope: 'post-hoc apparatus diagnosis; not an endpoint',
    questionlessWarrantMoments,
    questionForbiddenMoments,
    allQuestionlessWereQuestionForbidden:
      questionlessWarrantMoments > 0 && questionForbiddenMoments === questionlessWarrantMoments,
    examples,
  };
}

const committee = loadSealed(ROOT_5E, (job) => job.arm === 'committee');
const controls = loadSealed(ROOT_5E, (job) => job.arm === 'silent_control');

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
const nativeFrozenSixDensity = {
  scope: 'control-arm delivered turns at warrant_skip moments',
  regex: 'case-insensitive word-boundary frozen-six counts with possessive/plural suffixes',
  control: countProgram2Phase5eFrozenSixUnits(controlUnits),
};

// ---- verdicts ----
const committeeRate = pooledRate(committee);
const controlRate = pooledRate(controls);
const boot = bootstrap();
const e1Diff = committeeRate.rate !== null && controlRate.rate !== null ? committeeRate.rate - controlRate.rate : null;
const profileArmOpportunities = Object.fromEntries(
  PROFILES.flatMap((profile) =>
    [
      ['committee', committee],
      ['silent_control', controls],
    ].map(([arm, rows]) => [
      `${profile}|${arm}`,
      rows.filter((d) => d.job.profile === profile).reduce((sum, row) => sum + row.warrant.opp, 0),
    ]),
  ),
);
const densityPass = IS_PHASE5F
  ? committeeRate.opp >= DENSITY_MIN_COMMITTEE &&
    controlRate.opp >= DENSITY_MIN_CONTROL &&
    Object.values(profileArmOpportunities).every((count) => count >= DENSITY_MIN_PROFILE_CELL)
  : committeeRate.opp >= DENSITY_MIN_COMMITTEE &&
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
const analyzedRows = [...committee, ...controls];
const analyzedRowIds = new Set(analyzedRows.map((row) => row.job.id));
const cohortFinalized = LAUNCH_PLAN.jobs.every((job) => {
  if (analyzedRowIds.has(job.id)) return true;
  const state = LAUNCH_STATE.jobs?.[job.id];
  return state?.status === 'failed' && state?.attrition === true && Number(state?.attempts) >= 2;
});
const completionGate = evaluateProgram2LiveFutility({
  plan: LAUNCH_PLAN,
  launchState: LAUNCH_STATE,
  rows: analyzedRows,
  contract: { gateSpec: GATE_SPEC },
});
const nonDensityCompletionFailures = completionGate.reasons.filter(
  (reason) => !/opportunities remain possible/u.test(reason),
);
const technicalFailures = [
  ...(!cohortFinalized ? ['cohort has pending or unclassified jobs'] : []),
  ...nonDensityCompletionFailures,
];
const terminalVerdict = !densityPass
  ? { status: 'not_estimable', reason: 'insufficient_opportunities' }
  : technicalFailures.length > 0
    ? { status: 'not_estimable', reason: 'technical_gate_failure' }
    : e1Pass
      ? { status: 'supported', reason: 'positive_committee_difference' }
      : { status: 'not_supported', reason: 'density_sufficient_but_primary_endpoint_not_positive' };

const artifact = {
  schema: IS_PHASE5F
    ? 'machinespirits.program2.phase5f-analysis.v1'
    : 'machinespirits.program2.phase5e-r2-analysis.v1',
  generatedAt: new Date().toISOString(),
  preregistration: IS_PHASE5F
    ? 'PROGRAM-2-PHASE5F-FRESH-TRANSFER-PREREGISTRATION.md'
    : 'PROGRAM-2-PHASE5E-SECOND-TRANSFER-PREREGISTRATION.md',
  analysisPhase: ANALYSIS_PHASE,
  gateSpec: path.relative(REPO_ROOT, GATE_SPEC_FILE),
  world: transferLexicon.worldId,
  bootstrap: { draws: BOOT_DRAWS, seed: BOOT_SEED },
  sealed: { committee: committee.length, controls: controls.length },
  completionGate: { ...completionGate, cohortFinalized },
  e1e: {
    committee: committeeRate,
    control: controlRate,
    diff: e1Diff,
    bootstrap: boot.e1,
    density: {
      pass: densityPass,
      minimumPerArm: DENSITY_MIN_COMMITTEE,
      minimumPerProfileArm: DENSITY_MIN_PROFILE_CELL,
      byProfileArm: profileArmOpportunities,
    },
    densityPass,
    pass: e1Pass,
  },
  components: { committee: componentRates(committee), control: componentRates(controls) },
  handoffConflict: handoffConflictAnatomy(committee),
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
  nativeFrozenSixDensity,
  terminalVerdict,
  failures: {
    technical: technicalFailures,
    pedagogical:
      densityPass && technicalFailures.length === 0 && !e1Pass
        ? ['primary committee-minus-control endpoint did not clear its frozen positive-CI rule']
        : [],
  },
  lexicons: { marrick: marrickLexicon, transfer: transferLexicon },
  references: { phase5bCommitteeV2: '0.386 (32/83) on world_005_marrick', phase5bPooledControl: '0.150 (18/120)' },
};

function fmt(v, digits = 3) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits);
}
console.log(
  `[phase${ANALYSIS_PHASE}] world ${transferLexicon.worldId}: committee ${committeeRate.comp}/${committeeRate.opp} (${fmt(committeeRate.rate)}) vs control ${controlRate.comp}/${controlRate.opp} (${fmt(controlRate.rate)}) [fresh controls only, n=${controls.length} dialogues — no pooling]`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] E1 diff ${fmt(e1Diff)} CI ${boot.e1 ? `[${fmt(boot.e1.ci95[0])}, ${fmt(boot.e1.ci95[1])}]` : 'n/a'} -> ${e1Pass ? 'PASS' : 'no'}; density ${densityPass ? 'PASS' : 'FAIL'} (${committeeRate.opp} committee, ${controlRate.opp} control opportunities)`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] coverage ${fmt(meanCoverage(committee))} vs ${fmt(meanCoverage(controls))} (${coverageGuardrail ? 'PASS' : 'FAIL'}); safety ${fmt(safetyRate(committee), 2)} vs ${fmt(safetyRate(controls), 2)} (${safetyGuardrail ? 'PASS' : 'FAIL'})`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] components committee ${JSON.stringify(componentRates(committee))} | control ${JSON.stringify(componentRates(controls))}`,
);
console.log(`[phase${ANALYSIS_PHASE}] post-hoc handoff conflict: ${JSON.stringify(handoffConflictAnatomy(committee))}`);
console.log(
  `[phase${ANALYSIS_PHASE}] sources: ${JSON.stringify(sourceTally)}; fallback resolutions: ${JSON.stringify(fallbackTally)}`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] costume leak (${leakWords.length} Marrick-only words): committee ${costumeLeak.committee.totalOccurrences} occurrences over ${costumeLeak.committee.units} mini-authored units (${fmt(costumeLeak.committee.occurrencesPer1kWords, 1)}/1k words, ${costumeLeak.committee.unmistakableCostumeOccurrences} unmistakable-costume) vs control base rate ${costumeLeak.controlBaseRate.totalOccurrences} over ${costumeLeak.controlBaseRate.units} turns (${fmt(costumeLeak.controlBaseRate.occurrencesPer1kWords, 1)}/1k words, ${costumeLeak.controlBaseRate.unmistakableCostumeOccurrences} unmistakable-costume)`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] native frozen-six density in controls: ${nativeFrozenSixDensity.control.totalOccurrences} occurrences over ${nativeFrozenSixDensity.control.totalWords} words (${fmt(nativeFrozenSixDensity.control.occurrencesPer1kWords, 1)}/1k; ${nativeFrozenSixDensity.control.unitsWithCue}/${nativeFrozenSixDensity.control.units} turns with cue), per cue ${JSON.stringify(nativeFrozenSixDensity.control.perCue)}`,
);
console.log(
  `[phase${ANALYSIS_PHASE}] terminal verdict: ${terminalVerdict.status} (${terminalVerdict.reason}); technical failures ${JSON.stringify(technicalFailures)}`,
);
if (costumeLeak.committee.totalOccurrences) {
  console.log(`[phase${ANALYSIS_PHASE}] committee per-word leaks: ${JSON.stringify(costumeLeak.committee.perWord)}`);
  for (const ex of costumeLeak.committee.examples.slice(0, 8)) {
    console.log(`  LEAK "${ex.word}" ${ex.job} t${ex.turn}: ...${ex.snippet}...`);
  }
}
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[phase${ANALYSIS_PHASE}] wrote ${JSON_OUT}`);
}
