// Program-2 Phase 5d — delivery-integrity rider analysis
// (PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md §3-§5).
//
// Reads the 5d root (12 committee-v3 + 6 fresh controls) plus BOTH archived
// control sources (Phase 5's 12 + 5b's 6 = 18) for the frozen pooling rule:
// pooled control licensed iff |fresh − archived| warrant rate <= 0.10.
// Extraction inherited from analyze-program2-live-pilot-5b.mjs; adds the two
// 5d mechanism endpoints (M1 guard-eligible delivered cue-rate >= 0.75;
// M2 span cue-rate >= 0.85) and the live due-release ceiling reference.
// Bootstrap: dialogue-cluster, profile-stratified, two-sample, 5,000 draws,
// seed 20260722. E1d PASS = 95% CI > 0.
//
// Usage: node scripts/analyze-program2-live-pilot-5d.mjs [<5d-root>]
//   [--phase5-root <dir>] [--phase5b-root <dir>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT_5D = path.resolve(positional[0] || path.join(REPO_ROOT, 'exports/program2-live-pilot-5d'));
const argAfter = (flag, fallback) => {
  const idx = process.argv.indexOf(flag);
  return idx > -1 ? process.argv[idx + 1] : fallback;
};
const ROOT_5 = path.resolve(argAfter('--phase5-root', path.join(REPO_ROOT, 'exports/program2-live-pilot')));
const ROOT_5B = path.resolve(argAfter('--phase5b-root', path.join(REPO_ROOT, 'exports/program2-live-pilot-5b')));
const JSON_OUT = argAfter('--json', null);

const integrityPath = path.join(REPO_ROOT, 'services/tutorStubEvalIntegrity.js');
const { summarizeTutorStubFixedHorizon } = await import(pathToFileURL(integrityPath).href);
const enginePath = path.join(REPO_ROOT, 'services/program2CommitteeEngine.js');
const { PROGRAM2_WARRANT_CUE_RE } = await import(pathToFileURL(enginePath).href);
// Self-contained span-cue predicate: does the extracted span carry a frozen
// cue word? (Equivalent to the pinned-runtime committeeSpanCarriesCue, but
// depends only on PROGRAM2_WARRANT_CUE_RE, which exists on main — the runtime
// helper does not, so importing it would break this analyzer off the pinned
// branch.)
const spanCarriesCue = (span) => PROGRAM2_WARRANT_CUE_RE.test(String(span || ''));

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

// ---- frozen constants (5d prereg §3-§4) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = 20260722;
const PRIMARY_HORIZON = 16;
const PROFILES = ['proof_skipper', 'affective_resistant'];
const PRIMARY_TRIGGER = 'warrant_skip';
const STATIONARITY_MARGIN = 0.1;
const DENSITY_MIN_COMMITTEE = 15;
const COVERAGE_MARGIN = 0.05;
const SAFETY_MARGIN = 0.1;
const M1_BAR = 0.75; // guard-eligible delivered cue-rate
const M2_BAR = 0.85; // span cue-rate

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
    const fallbackResolutions = [];
    const moments = new Map(); // turn -> committee moment
    const guards = new Map(); // turn -> deliveryGuard record
    const complianceByTurn = new Map(); // turn -> compliance
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'turn_complete' && event.turnRecord) turnRecords.push(event.turnRecord);
      else if (event.type === 'point_of_action_compliance' && event.compliance?.trigger === PRIMARY_TRIGGER) {
        verdicts.push(event.compliance);
        complianceByTurn.set(event.turn, event.compliance);
      } else if (event.type === 'program2_committee_moment' && event.moment) {
        if (event.moment.fallback) fallbackResolutions.push(event.moment.fallback.resolution);
        moments.set(event.moment.turn, event.moment);
      } else if (event.type === 'program2_delivery_guard' && event.record) {
        guards.set(event.turn, event.record);
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
      fixedHorizon,
      fallbackResolutions,
      moments,
      guards,
      complianceByTurn,
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

const committee = loadSealed(ROOT_5D, (job) => job.arm === 'committee');
const freshControls = loadSealed(ROOT_5D, (job) => job.arm === 'silent_control');
const archivedControls = [
  ...loadSealed(ROOT_5, (job) => job.arm === 'silent_control'),
  ...loadSealed(ROOT_5B, (job) => job.arm === 'silent_control'),
];

const freshRate = pooledRate(freshControls);
const archivedRate = pooledRate(archivedControls);
const stationarityDelta =
  freshRate.rate !== null && archivedRate.rate !== null ? Math.abs(freshRate.rate - archivedRate.rate) : null;
const poolingLicensed = stationarityDelta !== null && stationarityDelta <= STATIONARITY_MARGIN;
const controls = poolingLicensed ? [...freshControls, ...archivedControls] : freshControls;

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

// ---- mechanism endpoints (5d prereg §4) ----
// M1: among realized guard-eligible moments (deliveryGuard.eligible), the
// delivered warrant_cue rate. M2: span cue-rate over committee moments that
// carry a span. Both computed over the committee arm only.
let m1Eligible = 0;
let m1Cue = 0;
let m2Spans = 0;
let m2Cue = 0;
let spanCueMiss = 0;
const guardTally = {};
const spanCueTally = {};
let dueRelease = 0;
let committeeMoments = 0;
for (const d of committee) {
  for (const [turn, guard] of d.guards) {
    const key = guard.applied ? 'applied' : guard.reason || 'unknown';
    guardTally[key] = (guardTally[key] || 0) + 1;
    if (guard.eligible) {
      m1Eligible += 1;
      const comp = d.complianceByTurn.get(turn);
      if (comp?.components?.warrant_cue) m1Cue += 1;
    }
  }
  for (const [, moment] of d.moments) {
    committeeMoments += 1;
    const outcome = moment.spanCue?.outcome || 'absent';
    spanCueTally[outcome] = (spanCueTally[outcome] || 0) + 1;
    if (moment.span) {
      m2Spans += 1;
      if (spanCarriesCue(moment.span)) m2Cue += 1;
      else spanCueMiss += 1;
    }
  }
  for (const v of d.verdicts) if ((v.released_premise_count || 0) > 0) dueRelease += 1;
}
const m1Rate = m1Eligible > 0 ? m1Cue / m1Eligible : null;
const m2Rate = m2Spans > 0 ? m2Cue / m2Spans : null;

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

// live due-release ceiling (reference, not a bar) — the census denominator
const achievable = committeeRate.opp - dueRelease;
const liveCeiling = committeeRate.opp > 0 ? achievable / committeeRate.opp : null;
const ofAchievable = achievable > 0 ? committeeRate.comp / achievable : null;

const artifact = {
  schema: 'machinespirits.program2.phase5d-analysis.v1',
  generatedAt: new Date().toISOString(),
  preregistration: 'PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md',
  bootstrap: { draws: BOOT_DRAWS, seed: BOOT_SEED },
  sealed: {
    committee: committee.length,
    freshControls: freshControls.length,
    archivedControls: archivedControls.length,
  },
  stationarity: {
    freshRate: freshRate.rate,
    archivedRate: archivedRate.rate,
    delta: stationarityDelta,
    margin: STATIONARITY_MARGIN,
    poolingLicensed,
    controlN: controls.length,
  },
  e1d: {
    committee: committeeRate,
    control: controlRate,
    diff: e1Diff,
    bootstrap: boot.e1,
    densityPass,
    pass: e1Pass,
  },
  mechanisms: {
    m1_guard_eligible_cue: {
      eligible: m1Eligible,
      cue: m1Cue,
      rate: m1Rate,
      bar: M1_BAR,
      pass: m1Rate !== null && m1Rate >= M1_BAR,
      reportedDescriptiveOnly: m1Eligible < 5,
    },
    m2_span_cue: {
      spans: m2Spans,
      cue: m2Cue,
      rate: m2Rate,
      bar: M2_BAR,
      pass: m2Rate !== null && m2Rate >= M2_BAR,
      spanCueMiss,
    },
  },
  guardrails: {
    coverage: {
      committee: meanCoverage(committee),
      control: meanCoverage(controls),
      bootstrap: boot.coverage,
      pass: coverageGuardrail,
    },
    safety: { committee: safetyRate(committee), control: safetyRate(controls), pass: safetyGuardrail },
    seam: 'PENDING — mandatory seam re-check runs as a separate paid harness (prereg §4)',
  },
  liveCeilingReference: {
    moments: committeeRate.opp,
    dueRelease,
    achievable,
    ceiling: liveCeiling,
    rateOfAchievable: ofAchievable,
    prediction: 0.55,
    phase5bCommitteeReference: '0.386 (32/83)',
    phase5bCeilingReference: '49/83 ≈ 0.59',
  },
  spanCueTally,
  guardTally,
  fallbackTally,
  committeeMoments,
};

function fmt(v, digits = 3) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits);
}
console.log(
  `[phase5d] committee ${committeeRate.comp}/${committeeRate.opp} (${fmt(committeeRate.rate)}) vs control ${controlRate.comp}/${controlRate.opp} (${fmt(controlRate.rate)}) [pooling ${poolingLicensed ? 'licensed' : 'NOT licensed'}, control n=${controls.length}; stationarity Δ ${fmt(stationarityDelta)}]`,
);
console.log(
  `[phase5d] E1d diff ${fmt(e1Diff)} CI ${boot.e1 ? `[${fmt(boot.e1.ci95[0])}, ${fmt(boot.e1.ci95[1])}]` : 'n/a'} -> ${e1Pass ? 'PASS' : 'FAIL'}; density ${densityPass ? 'PASS' : 'FAIL'}`,
);
console.log(
  `[phase5d] M1 guard-eligible cue ${m1Cue}/${m1Eligible} (${fmt(m1Rate)}) bar ${M1_BAR} -> ${m1Eligible < 5 ? 'DESCRIPTIVE (n<5)' : m1Rate >= M1_BAR ? 'PASS' : 'FAIL'}`,
);
console.log(
  `[phase5d] M2 span cue ${m2Cue}/${m2Spans} (${fmt(m2Rate)}) bar ${M2_BAR} -> ${m2Rate !== null && m2Rate >= M2_BAR ? 'PASS' : 'FAIL'}; span_cue_miss ${spanCueMiss}`,
);
console.log(
  `[phase5d] coverage ${fmt(meanCoverage(committee))} vs ${fmt(meanCoverage(controls))} (${coverageGuardrail ? 'PASS' : 'FAIL'}); safety ${fmt(safetyRate(committee), 2)} vs ${fmt(safetyRate(controls), 2)} (${safetyGuardrail ? 'PASS' : 'FAIL'}); seam PENDING`,
);
console.log(
  `[phase5d] live ceiling: ${dueRelease}/${committeeRate.opp} due-release; achievable ${achievable}/${committeeRate.opp} = ${fmt(liveCeiling)}; rate is ${fmt(ofAchievable)} of achievable (prediction 0.55; 5b 0.386)`,
);
console.log(`[phase5d] spanCue: ${JSON.stringify(spanCueTally)}`);
console.log(`[phase5d] guard: ${JSON.stringify(guardTally)}`);
console.log(`[phase5d] fallback: ${JSON.stringify(fallbackTally)}`);
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[phase5d] wrote ${JSON_OUT}`);
}
