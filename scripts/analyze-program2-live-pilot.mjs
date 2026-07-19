// Program-2 Phase 5 live committee pilot — frozen endpoint analysis
// (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §3, §7).
//
// Aggregator only: trigger assignments and compliance verdicts are read from
// the sealed point_of_action_assignment / point_of_action_compliance events
// (detector step4-frozen-2026-07-14.v1); committee mechanics from the sealed
// program2_committee_moment events. Per-dialogue extraction is inherited from
// the frozen Step 4 analyzer (scripts/analyze-step4-compliance.mjs) with the
// pilot's two arms. Fixed-horizon outcomes reuse summarizeTutorStubFixedHorizon.
//
// Usage: node scripts/analyze-program2-live-pilot.mjs [<root>] [--json <out>]
//   <root> defaults to exports/program2-live-pilot under the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = path.resolve(positional[0] || path.join(REPO_ROOT, 'exports/program2-live-pilot'));
const jsonOutIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonOutIdx > -1 ? process.argv[jsonOutIdx + 1] : null;

const integrityPath = path.join(REPO_ROOT, 'services/tutorStubEvalIntegrity.js');
const { summarizeTutorStubFixedHorizon } = await import(pathToFileURL(integrityPath).href);

// Verbatim copy of the frozen apparatus RNG.
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

// ---- frozen constants (prereg §2-§3) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = 20260718;
const PRIMARY_HORIZON = 16;
const TURN_MIN = 3;
const TURN_MAX = 24;
const ARMS = ['committee', 'silent_control'];
const PROFILES = ['proof_skipper', 'affective_resistant'];
const PRIMARY_TRIGGER = 'warrant_skip';
const DENSITY_MIN_PER_ARM = 15;
const COVERAGE_MARGIN = 0.05;
const TAX_POINT = 0.1;
const SAFETY_MARGIN = 0.1;
const COMMITTEE_DELIVERED_SOURCES = new Set([
  'composed',
  'fallback_no_span',
  'fallback_span_lost',
  'fallback_multi_question',
  'fallback_empty',
  'fallback_error',
]);

const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'launch-plan.json'), 'utf8')).plan;
if (plan.jobs.length !== 24) throw new Error(`expected 24 jobs, got ${plan.jobs.length}`);
if (Number(plan.primaryHorizon) !== PRIMARY_HORIZON)
  throw new Error(`plan primaryHorizon ${plan.primaryHorizon} != frozen ${PRIMARY_HORIZON}`);
if (plan.detectorVersion && plan.detectorVersion !== DETECTOR_VERSION)
  throw new Error(`plan detectorVersion ${plan.detectorVersion} != frozen ${DETECTOR_VERSION}`);

// ---- per-dialogue extraction (inherited from the frozen Step 4 analyzer) ----
function parseDialogue(job) {
  const dir = path.join(ROOT, 'traces', job.id);
  if (!fs.existsSync(dir)) return { job, sealed: false, reason: 'no trace directory' };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const candidates = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    if (text.includes('point_of_action_assignment'))
      candidates.push({ f, text, sealed: text.includes('"type":"run_end"') });
  }
  if (!candidates.length) return { job, sealed: false, reason: 'no point-of-action trace file' };
  const sealedFiles = candidates.filter((c) => c.sealed);
  if (sealedFiles.length > 1)
    throw new Error(`${job.id}: ${sealedFiles.length} sealed trace files — adjudication required`);
  if (!sealedFiles.length)
    return { job, sealed: false, reason: `no run_end (${candidates.length} partial attempt trace(s) only)` };
  const events = sealedFiles[0].text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const detectorVersions = new Set();
  const armsStamped = new Set();
  const opportunities = [];
  const verdicts = [];
  const turnRecords = [];
  const guardCategories = new Set();
  const windowViolations = [];
  const committeeMoments = [];

  for (const ev of events) {
    if (ev.type === 'point_of_action_assignment' && ev.pointOfAction) {
      const pa = ev.pointOfAction;
      detectorVersions.add(pa.detector_version);
      armsStamped.add(pa.arm);
      if (pa.assigned_trigger) {
        opportunities.push({ turn: pa.turn, trigger: pa.assigned_trigger, cofire: pa.cofire });
        if (pa.turn < TURN_MIN || pa.turn > TURN_MAX) windowViolations.push(pa.turn);
      }
    } else if (ev.type === 'point_of_action_compliance' && ev.compliance) {
      const c = ev.compliance;
      detectorVersions.add(c.detector_version);
      armsStamped.add(c.arm);
      verdicts.push({
        turn: c.turn,
        trigger: c.trigger,
        compliant: c.compliant === true,
        components: c.components,
        realized: c.realized_action_family,
      });
    } else if (ev.type === 'program2_committee_moment' && ev.moment) {
      committeeMoments.push({ turn: ev.turn, ...ev.moment });
    } else if (ev.type === 'turn_complete' && ev.turnRecord) {
      turnRecords.push(ev.turnRecord);
    } else if (ev.type === 'tutor_response_fallback') {
      for (const value of Object.values(ev)) {
        if (!Array.isArray(value)) continue;
        for (const issue of value) {
          if (issue && typeof issue === 'object' && typeof issue.type === 'string') guardCategories.add(issue.type);
        }
      }
    }
  }

  if (detectorVersions.size && (detectorVersions.size !== 1 || !detectorVersions.has(DETECTOR_VERSION)))
    throw new Error(`${job.id}: detector versions ${[...detectorVersions]}`);
  if (armsStamped.size && (armsStamped.size !== 1 || !armsStamped.has(job.arm)))
    throw new Error(`${job.id}: stamped arm ${[...armsStamped]} != plan arm ${job.arm}`);
  if (opportunities.length !== verdicts.length)
    throw new Error(`${job.id}: ${opportunities.length} opportunities but ${verdicts.length} compliance verdicts`);
  if (job.arm === 'silent_control' && committeeMoments.length)
    throw new Error(`${job.id}: silent_control dialogue carries committee moments`);

  const warrantVerdicts = verdicts.filter((v) => v.trigger === PRIMARY_TRIGGER);
  const fixedHorizon = summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon: PRIMARY_HORIZON });
  const fullLeaks = turnRecords.reduce((sum, tr) => {
    const leaks = tr?.tutorLeakAudit?.leaks;
    if (Array.isArray(leaks)) return sum + leaks.length;
    return sum + (tr?.tutorLeakAudit?.ok === false ? 1 : 0);
  }, 0);

  return {
    job,
    sealed: true,
    warrant: { opp: warrantVerdicts.length, comp: warrantVerdicts.filter((v) => v.compliant).length },
    stagnant: {
      opp: verdicts.filter((v) => v.trigger === 'stagnant_repeat').length,
      comp: verdicts.filter((v) => v.trigger === 'stagnant_repeat' && v.compliant).length,
    },
    verdicts,
    committeeMoments,
    fixedHorizon,
    fullLeaks,
    guardCategories: [...guardCategories].sort(),
    windowViolations,
    turnCount: turnRecords.length,
  };
}

const dialogues = plan.jobs.map(parseDialogue);
const sealedRows = dialogues.filter((d) => d.sealed);
const excluded = dialogues.filter((d) => !d.sealed);

function armRows(arm) {
  return sealedRows.filter((d) => d.job.arm === arm);
}
function pooledWarrantRate(rows) {
  const opp = rows.reduce((s, d) => s + d.warrant.opp, 0);
  const comp = rows.reduce((s, d) => s + d.warrant.comp, 0);
  return { opp, comp, rate: opp > 0 ? comp / opp : null };
}
function meanCoverage(rows) {
  const values = rows.map((d) => d.fixedHorizon.coverageAtHorizon).filter((v) => v !== null && v !== undefined);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function summarizeArm(arm) {
  const rows = armRows(arm);
  const warrant = pooledWarrantRate(rows);
  const channelContribution = rows.filter((d) => d.job.profile === 'proof_skipper').some((d) => d.warrant.opp > 0);
  const committeeSources = {};
  let committeeDelivered = 0;
  for (const d of rows) {
    for (const m of d.committeeMoments) {
      committeeSources[m.source] = (committeeSources[m.source] || 0) + 1;
      if (COMMITTEE_DELIVERED_SOURCES.has(m.source)) committeeDelivered += 1;
    }
  }
  return {
    arm,
    n: rows.length,
    nByProfile: Object.fromEntries(PROFILES.map((p) => [p, rows.filter((d) => d.job.profile === p).length])),
    warrant,
    stagnantOpp: rows.reduce((s, d) => s + d.stagnant.opp, 0),
    densityPass: warrant.opp >= DENSITY_MIN_PER_ARM && channelContribution,
    channelContribution,
    meanCoverage: meanCoverage(rows),
    safetyPassRate: rows.length ? rows.filter((d) => d.fixedHorizon.hardSafetyPassed).length / rows.length : null,
    fullLeaksByDialogue: rows.map((d) => ({ id: d.job.id, leaks: d.fullLeaks })),
    horizonLeaksByDialogue: rows.map((d) => ({ id: d.job.id, leaks: d.fixedHorizon.leakCount })),
    guardCategories: [...new Set(rows.flatMap((d) => d.guardCategories))].sort(),
    committeeSources,
    committeeDelivered,
    windowViolations: rows.flatMap((d) => d.windowViolations),
  };
}

const cells = Object.fromEntries(ARMS.map((arm) => [arm, summarizeArm(arm)]));

// ---- bootstrap (frozen: 5000 dialogue-cluster draws, stratified by profile,
// two-sample; seed 20260718). Statistics per draw: pooled warrant_skip
// compliance rate (E1) and mean coverage@16 (E2). ----
function bootstrapContrasts() {
  const random = mulberry32(BOOT_SEED);
  const strata = (arm) => PROFILES.map((p) => armRows(arm).filter((d) => d.job.profile === p));
  const committeeStrata = strata('committee');
  const controlStrata = strata('silent_control');
  const e1Draws = [];
  const e2Draws = [];
  let degenerate = 0;
  const sample = (strataRows) => {
    const picked = [];
    for (const rows of strataRows) {
      for (let k = 0; k < rows.length; k += 1) picked.push(rows[Math.floor(random() * rows.length)]);
    }
    return picked;
  };
  for (let i = 0; i < BOOT_DRAWS; i += 1) {
    const committeePick = sample(committeeStrata);
    const controlPick = sample(controlStrata);
    const e1c = pooledWarrantRate(committeePick).rate;
    const e1s = pooledWarrantRate(controlPick).rate;
    if (e1c === null || e1s === null) {
      degenerate += 1;
      e1Draws.push(null);
    } else {
      e1Draws.push(e1c - e1s);
    }
    const e2c = meanCoverage(committeePick);
    const e2s = meanCoverage(controlPick);
    e2Draws.push(e2c !== null && e2s !== null ? e2c - e2s : null);
  }
  const ci = (draws) => {
    const valid = draws.filter((d) => d !== null).sort((a, b) => a - b);
    if (!valid.length) return null;
    const q = (p) => valid[Math.min(valid.length - 1, Math.max(0, Math.floor(p * valid.length)))];
    return { draws: valid.length, ci95: [q(0.025), q(0.975)] };
  };
  return { e1: ci(e1Draws), e2: ci(e2Draws), degenerateDraws: degenerate };
}

const committee = cells.committee;
const control = cells.silent_control;
const boot = bootstrapContrasts();

const e1Diff =
  committee.warrant.rate !== null && control.warrant.rate !== null
    ? committee.warrant.rate - control.warrant.rate
    : null;
const e2Diff =
  committee.meanCoverage !== null && control.meanCoverage !== null
    ? committee.meanCoverage - control.meanCoverage
    : null;

const densityPrecondition = committee.densityPass && control.densityPass;
const e1Pass = densityPrecondition && boot.e1 !== null && boot.e1.ci95[0] > 0;
const e2Reading = !densityPrecondition
  ? 'descriptive_only'
  : e2Diff === null || boot.e2 === null
    ? 'unmeasured'
    : boot.e2.ci95[0] > -COVERAGE_MARGIN
      ? 'no_enforcement_scale_tax'
      : e2Diff <= -TAX_POINT
        ? 'enforcement_scale_tax'
        : 'intermediate';
const safetyGuardrail =
  committee.safetyPassRate !== null &&
  control.safetyPassRate !== null &&
  committee.safetyPassRate >= control.safetyPassRate - SAFETY_MARGIN;

const artifact = {
  schema: 'machinespirits.tutor-stub.program2-phase5-live-pilot-analysis.v1',
  generatedAt: new Date().toISOString(),
  preregistration: 'PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md',
  detectorVersion: DETECTOR_VERSION,
  bootstrap: { draws: BOOT_DRAWS, seed: BOOT_SEED, scheme: 'dialogue-cluster, profile-stratified, two-sample' },
  sealedDialogues: sealedRows.length,
  excluded: excluded.map((d) => ({ id: d.job.id, reason: d.reason })),
  cells,
  densityPrecondition: {
    pass: densityPrecondition,
    minPerArm: DENSITY_MIN_PER_ARM,
    warrantOpp: { committee: committee.warrant.opp, silent_control: control.warrant.opp },
    proofSkipperChannel: {
      committee: committee.channelContribution,
      silent_control: control.channelContribution,
    },
  },
  e1: {
    committeeRate: committee.warrant.rate,
    controlRate: control.warrant.rate,
    diff: e1Diff,
    bootstrap: boot.e1,
    pass: e1Pass,
  },
  e2: {
    committeeCoverage: committee.meanCoverage,
    controlCoverage: control.meanCoverage,
    diff: e2Diff,
    bootstrap: boot.e2,
    coverageMargin: COVERAGE_MARGIN,
    taxPoint: TAX_POINT,
    reading: e2Reading,
  },
  e3: {
    status: 'pending_seam_review',
    committeeDeliveredTurns: committee.committeeDelivered,
    note: 'run the seam review per prereg §3 E3 after arm completion; frontier_mini_unavailable turns excluded',
  },
  guardrails: {
    safetyWithinMargin: safetyGuardrail,
    safetyPassRate: { committee: committee.safetyPassRate, silent_control: control.safetyPassRate },
    fullLeaks: {
      committee: committee.fullLeaksByDialogue.reduce((s, d) => s + d.leaks, 0),
      silent_control: control.fullLeaksByDialogue.reduce((s, d) => s + d.leaks, 0),
    },
    windowViolations: { committee: committee.windowViolations, silent_control: control.windowViolations },
  },
  degenerateDraws: boot.degenerateDraws,
};

function fmt(v, digits = 3) {
  return v === null || v === undefined ? 'n/a' : Number(v).toFixed(digits);
}
console.log(`[phase5-analysis] sealed ${sealedRows.length}/24 (excluded ${excluded.length})`);
for (const arm of ARMS) {
  const c = cells[arm];
  console.log(
    `  ${arm}: n=${c.n} warrant ${c.warrant.comp}/${c.warrant.opp} (${fmt(c.warrant.rate)}) coverage@16 ${fmt(c.meanCoverage)} safety ${fmt(c.safetyPassRate, 2)} committee_moments ${JSON.stringify(c.committeeSources)}`,
  );
}
console.log(
  `  E1 diff ${fmt(e1Diff)} CI ${boot.e1 ? `[${fmt(boot.e1.ci95[0])}, ${fmt(boot.e1.ci95[1])}]` : 'n/a'} -> ${e1Pass ? 'PASS' : 'no'}`,
);
console.log(
  `  E2 diff ${fmt(e2Diff)} CI ${boot.e2 ? `[${fmt(boot.e2.ci95[0])}, ${fmt(boot.e2.ci95[1])}]` : 'n/a'} -> ${e2Reading}`,
);
console.log(`  density precondition: ${densityPrecondition ? 'PASS' : 'FAIL'}; safety guardrail: ${safetyGuardrail}`);
if (JSON_OUT) {
  fs.writeFileSync(path.resolve(JSON_OUT), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[phase5-analysis] wrote ${JSON_OUT}`);
}
