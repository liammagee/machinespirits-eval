// Program-2 Phase 5b — fallback-battery confirm analysis
// (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §3-§5).
//
// Reads the 5b root (12 committee-v2 + 6 fresh controls) plus the Phase 5
// root (12 archived controls) for the frozen pooling rule: pooled control
// licensed only if |fresh − archived| pooled warrant rate <= 0.10.
// Extraction inherited from analyze-program2-live-pilot.mjs. Bootstrap:
// dialogue-cluster, profile-stratified, two-sample, 5,000 draws, seed
// 20260720. E1b PASS = 95% CI > 0.
//
// Usage: node scripts/analyze-program2-live-pilot-5b.mjs [<5b-root>] [--phase5-root <dir>] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT_5B = path.resolve(positional[0] || path.join(REPO_ROOT, 'exports/program2-live-pilot-5b'));
const phase5Idx = process.argv.indexOf('--phase5-root');
const ROOT_5 = path.resolve(
  phase5Idx > -1 ? process.argv[phase5Idx + 1] : path.join(REPO_ROOT, 'exports/program2-live-pilot'),
);
const jsonOutIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonOutIdx > -1 ? process.argv[jsonOutIdx + 1] : null;

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

// ---- frozen constants (5b prereg §3-§4) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = 20260720;
const PRIMARY_HORIZON = 16;
const PROFILES = ['proof_skipper', 'affective_resistant'];
const PRIMARY_TRIGGER = 'warrant_skip';
const STATIONARITY_MARGIN = 0.1;
const DENSITY_MIN_COMMITTEE = 15;
const COVERAGE_MARGIN = 0.05;
const SAFETY_MARGIN = 0.1;

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
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'turn_complete' && event.turnRecord) turnRecords.push(event.turnRecord);
      else if (event.type === 'point_of_action_compliance' && event.compliance?.trigger === PRIMARY_TRIGGER)
        verdicts.push(event.compliance);
      else if (event.type === 'program2_committee_moment' && event.moment?.fallback)
        fallbackResolutions.push(event.moment.fallback.resolution);
      if (event.type === 'point_of_action_compliance' && event.compliance?.detector_version) {
        if (event.compliance.detector_version !== DETECTOR_VERSION)
          throw new Error(`${job.id}: detector ${event.compliance.detector_version}`);
      }
    }
    const fixedHorizon = summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon: PRIMARY_HORIZON });
    rows.push({
      job,
      warrant: { opp: verdicts.length, comp: verdicts.filter((v) => v.compliant === true).length },
      fixedHorizon,
      fallbackResolutions,
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

const committee = loadSealed(ROOT_5B, (job) => job.arm === 'committee');
const freshControls = loadSealed(ROOT_5B, (job) => job.arm === 'silent_control');
const archivedControls = loadSealed(ROOT_5, (job) => job.arm === 'silent_control');

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

const artifact = {
  schema: 'machinespirits.program2.phase5b-analysis.v1',
  generatedAt: new Date().toISOString(),
  preregistration: 'PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md',
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
  e1b: {
    committee: committeeRate,
    control: controlRate,
    diff: e1Diff,
    bootstrap: boot.e1,
    densityPass,
    pass: e1Pass,
  },
  guardrails: {
    coverage: { committee: meanCoverage(committee), control: meanCoverage(controls), pass: coverageGuardrail },
    safety: { committee: safetyRate(committee), control: safetyRate(controls), pass: safetyGuardrail },
  },
  fallbackTally,
  phase5CommitteeReference: '0.200 (15/75), Phase 5 §9',
};

function fmt(v, digits = 3) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits);
}
console.log(
  `[phase5b] committee ${committeeRate.comp}/${committeeRate.opp} (${fmt(committeeRate.rate)}) vs control ${controlRate.comp}/${controlRate.opp} (${fmt(controlRate.rate)}) [pooling ${poolingLicensed ? 'licensed' : 'NOT licensed'}, control n=${controls.length} dialogues]`,
);
console.log(
  `[phase5b] E1b diff ${fmt(e1Diff)} CI ${boot.e1 ? `[${fmt(boot.e1.ci95[0])}, ${fmt(boot.e1.ci95[1])}]` : 'n/a'} -> ${e1Pass ? 'PASS' : 'no'}; density ${densityPass ? 'PASS' : 'FAIL'}`,
);
console.log(
  `[phase5b] coverage ${fmt(meanCoverage(committee))} vs ${fmt(meanCoverage(controls))} (${coverageGuardrail ? 'PASS' : 'FAIL'}); safety ${fmt(safetyRate(committee), 2)} vs ${fmt(safetyRate(controls), 2)} (${safetyGuardrail ? 'PASS' : 'FAIL'})`,
);
console.log(`[phase5b] fallback resolutions: ${JSON.stringify(fallbackTally)}`);
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[phase5b] wrote ${JSON_OUT}`);
}
