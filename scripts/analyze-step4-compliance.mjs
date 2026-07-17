// Step 4 point-of-action coaching — frozen compliance analysis.
//
// Implements POINT-OF-ACTION-COACHING-PREREGISTRATION.md §6 (density gate),
// §7 (primary endpoint + guardrails), §8 (decision grammar) as an aggregator
// over the runtime's persisted per-turn events. NOTHING is re-derived: the
// trigger assignments and compliance verdicts are read from the sealed
// point_of_action_assignment / point_of_action_compliance events stamped with
// detector_version step4-frozen-2026-07-14.v1. Fixed-horizon outcomes reuse
// the same service the Step 2 analysis used (summarizeTutorStubFixedHorizon).
//
// Usage: node step4-compliance-analysis.mjs <worktree-root> [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2];
if (!ROOT) {
  console.error('Usage: node scripts/analyze-step4-compliance.mjs <step4-worktree-or-archive-root> [--json <out>]');
  process.exit(1);
}
const jsonOutIdx = process.argv.indexOf('--json');
const JSON_OUT = jsonOutIdx > -1 ? process.argv[jsonOutIdx + 1] : null;
const RUNS = path.join(ROOT, 'exports/tutor-stub-step4-claim-runs');

// Prefer the frozen worktree's own copy of the fixed-horizon service when ROOT
// is a checkout; fall back to this repo's copy when ROOT is a traces-only
// archive. Both trace to the same frozen definitions.
const integrityPath = fs.existsSync(path.join(ROOT, 'services/tutorStubEvalIntegrity.js'))
  ? path.join(ROOT, 'services/tutorStubEvalIntegrity.js')
  : new URL('../services/tutorStubEvalIntegrity.js', import.meta.url).pathname;
const { summarizeTutorStubFixedHorizon } = await import(pathToFileURL(integrityPath).href);

// Verbatim copy of the frozen apparatus RNG
// (scripts/analyze-register-confirmatory-step2.js, mulberry32).
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

// ---- frozen constants (prereg §5-§7) ----
const DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
const BOOT_DRAWS = 5000;
const BOOT_SEED = 20260714;
const PRIMARY_HORIZON = 16;
const TURN_MIN = 3;
const TURN_MAX = 24;
const DENSITY = { warrant_skip: 25, stagnant_repeat: 12 };
const CHANNEL_PROFILE = { warrant_skip: 'proof_skipper', stagnant_repeat: 'affective_resistant' };
const TRIGGERS = ['stagnant_repeat', 'warrant_skip'];
const ARMS = ['standing_book', 'triggered_placebo', 'side_coach', 'compiled_constraint'];
const TREATMENTS = ['side_coach', 'compiled_constraint'];
const PROFILES = ['proof_skipper', 'affective_resistant'];
const MIN_DIFF = 0.15;
const COVERAGE_MARGIN = 0.05;
const SAFETY_MARGIN = 0.1;

const plan = JSON.parse(fs.readFileSync(path.join(RUNS, 'launch-plan.json'), 'utf8')).plan;
if (plan.jobs.length !== 80) throw new Error(`expected 80 jobs, got ${plan.jobs.length}`);
if (Number(plan.primaryHorizon) !== PRIMARY_HORIZON)
  throw new Error(`plan primaryHorizon ${plan.primaryHorizon} != frozen ${PRIMARY_HORIZON}`);
if (plan.detectorVersion && plan.detectorVersion !== DETECTOR_VERSION)
  throw new Error(`plan detectorVersion ${plan.detectorVersion} != frozen ${DETECTOR_VERSION}`);

const FAMILIES = [...new Set(plan.jobs.map((j) => j.tutorFamily))].sort();

// ---- per-dialogue extraction ----
function parseDialogue(job) {
  const dir = path.join(RUNS, 'traces', job.id);
  if (!fs.existsSync(dir)) return { job, sealed: false, reason: 'no trace directory' };
  // A job dir may hold partial traces from crashed attempts alongside the one
  // sealed retry. Claim-bearing trace = the file containing run_end; two
  // sealed files for one job would be an integrity failure.
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
    return {
      job,
      sealed: false,
      reason: `no run_end (${candidates.length} partial attempt trace(s) only)`,
    };
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

  const perTrigger = {};
  for (const t of TRIGGERS) {
    const rows = verdicts.filter((v) => v.trigger === t);
    perTrigger[t] = { opp: rows.length, comp: rows.filter((v) => v.compliant).length };
  }

  const fixedHorizon = summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon: PRIMARY_HORIZON });
  const fullLeaks = turnRecords.reduce((sum, tr) => {
    const leaks = tr?.tutorLeakAudit?.leaks;
    if (Array.isArray(leaks)) return sum + leaks.length;
    return sum + (tr?.tutorLeakAudit?.ok === false ? 1 : 0);
  }, 0);

  return {
    job,
    sealed: true,
    perTrigger,
    verdicts,
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

// ---- aggregation per family x arm ----
function cellRows(family, arm) {
  return sealedRows.filter((d) => d.job.tutorFamily === family && d.job.arm === arm);
}
function pooledRate(rows, trigger) {
  const opp = rows.reduce((s, d) => s + d.perTrigger[trigger].opp, 0);
  const comp = rows.reduce((s, d) => s + d.perTrigger[trigger].comp, 0);
  return { opp, comp, rate: opp > 0 ? comp / opp : null };
}
function macroOf(rates) {
  const defined = rates.filter((r) => r !== null);
  return defined.length ? defined.reduce((s, r) => s + r, 0) / defined.length : null;
}

function summarizeCell(family, arm) {
  const rows = cellRows(family, arm);
  const t1 = pooledRate(rows, 'stagnant_repeat');
  const t2 = pooledRate(rows, 'warrant_skip');
  const channelContribution = {};
  for (const t of TRIGGERS) {
    const prof = CHANNEL_PROFILE[t];
    channelContribution[t] = rows.filter((d) => d.job.profile === prof).some((d) => d.perTrigger[t].opp > 0);
  }
  const densityPass =
    t2.opp >= DENSITY.warrant_skip &&
    t1.opp >= DENSITY.stagnant_repeat &&
    channelContribution.stagnant_repeat &&
    channelContribution.warrant_skip;
  const coverages = rows.map((d) => d.fixedHorizon.coverageAtHorizon);
  const meanCoverage = coverages.length ? coverages.reduce((s, v) => s + v, 0) / coverages.length : null;
  const safetyPassRate = rows.length ? rows.filter((d) => d.fixedHorizon.hardSafetyPassed).length / rows.length : null;
  return {
    family,
    arm,
    n: rows.length,
    nByProfile: Object.fromEntries(PROFILES.map((p) => [p, rows.filter((d) => d.job.profile === p).length])),
    stagnant_repeat: t1,
    warrant_skip: t2,
    macro: macroOf([t1.rate, t2.rate]),
    densityPass,
    channelContribution,
    meanCoverage,
    safetyPassRate,
    fullLeaksByDialogue: rows.map((d) => ({ id: d.job.id, leaks: d.fullLeaks })),
    horizonLeaksByDialogue: rows.map((d) => ({ id: d.job.id, leaks: d.fixedHorizon.leakCount })),
    guardCategories: [...new Set(rows.flatMap((d) => d.guardCategories))].sort(),
  };
}

const cells = {};
for (const family of FAMILIES) {
  cells[family] = {};
  for (const arm of ARMS) cells[family][arm] = summarizeCell(family, arm);
}

// ---- bootstrap (frozen: 5000 dialogue-cluster draws, stratified by profile
// and trigger, seed 20260714). Dialogues are the resampling clusters, drawn
// with replacement within each profile stratum of each arm; trigger channels
// are computed separately per draw and macro-averaged, so the trigger
// stratification is carried by the macro structure. Treatment and placebo are
// resampled independently (two-sample bootstrap). ----
function bootstrapContrast(family, treatmentArm) {
  const random = mulberry32(BOOT_SEED);
  const strata = (arm) => PROFILES.map((p) => cellRows(family, arm).filter((d) => d.job.profile === p));
  const treatStrata = strata(treatmentArm);
  const placeboStrata = strata('triggered_placebo');
  const draws = [];
  let degenerate = 0;
  for (let i = 0; i < BOOT_DRAWS; i += 1) {
    const sample = (strataRows) => {
      const picked = [];
      for (const rows of strataRows) {
        for (let k = 0; k < rows.length; k += 1) picked.push(rows[Math.floor(random() * rows.length)]);
      }
      const rates = TRIGGERS.map((t) => pooledRate(picked, t).rate);
      if (rates.some((r) => r === null)) degenerate += 1;
      return macroOf(rates);
    };
    const tm = sample(treatStrata);
    const pm = sample(placeboStrata);
    draws.push(tm !== null && pm !== null ? tm - pm : null);
  }
  const valid = draws.filter((d) => d !== null).sort((a, b) => a - b);
  const q = (p) => valid[Math.min(valid.length - 1, Math.max(0, Math.floor(p * valid.length)))];
  return {
    draws: valid.length,
    degenerateChannelDraws: degenerate,
    ci95: valid.length ? [q(0.025), q(0.975)] : null,
  };
}

// ---- verdicts (frozen §7 conditions + §7 guardrails, §8 grammar) ----
const results = {};
for (const family of FAMILIES) {
  const placebo = cells[family].triggered_placebo;
  results[family] = {};
  for (const arm of TREATMENTS) {
    const cell = cells[family][arm];
    const diffs = {};
    for (const t of TRIGGERS) {
      diffs[t] = cell[t].rate !== null && placebo[t].rate !== null ? cell[t].rate - placebo[t].rate : null;
    }
    const macroDiff = cell.macro !== null && placebo.macro !== null ? cell.macro - placebo.macro : null;
    const boot = bootstrapContrast(family, arm);
    const conditions = {
      c1_macro_diff_at_least_015: macroDiff !== null && macroDiff >= MIN_DIFF,
      c2_ci_lower_above_zero: boot.ci95 !== null && boot.ci95[0] > 0,
      c3_both_trigger_diffs_positive: TRIGGERS.every((t) => diffs[t] !== null && diffs[t] > 0),
      c4_density_gates_pass: cell.densityPass && placebo.densityPass,
    };
    const guardrails = {
      coverage_within_margin:
        cell.meanCoverage !== null &&
        placebo.meanCoverage !== null &&
        cell.meanCoverage >= placebo.meanCoverage - COVERAGE_MARGIN,
      safety_within_margin:
        cell.safetyPassRate !== null &&
        placebo.safetyPassRate !== null &&
        cell.safetyPassRate >= placebo.safetyPassRate - SAFETY_MARGIN,
      zero_leaks_every_treatment_dialogue: cell.fullLeaksByDialogue.every((d) => d.leaks === 0),
      zero_leaks_horizon_only: cell.horizonLeaksByDialogue.every((d) => d.leaks === 0),
      no_new_guard_category: cell.guardCategories.every((c) =>
        new Set([
          ...cells[family].triggered_placebo.guardCategories,
          ...cells[family].standing_book.guardCategories,
        ]).has(c),
      ),
      new_categories: cell.guardCategories.filter(
        (c) =>
          !new Set([
            ...cells[family].triggered_placebo.guardCategories,
            ...cells[family].standing_book.guardCategories,
          ]).has(c),
      ),
    };
    const compliancePass = Object.values(conditions).every(Boolean);
    const guardrailPass =
      guardrails.coverage_within_margin &&
      guardrails.safety_within_margin &&
      guardrails.zero_leaks_every_treatment_dialogue &&
      guardrails.no_new_guard_category;
    results[family][arm] = {
      macro: cell.macro,
      placeboMacro: placebo.macro,
      macroDiff,
      triggerDiffs: diffs,
      bootstrap: boot,
      conditions,
      guardrails,
      compliancePass,
      guardrailPass,
      pass: compliancePass && guardrailPass,
    };
  }
  // secondary point contrasts (no bootstrap per prereg)
  results[family].secondary = {
    side_coach_minus_standing_book:
      cells[family].side_coach.macro !== null && cells[family].standing_book.macro !== null
        ? cells[family].side_coach.macro - cells[family].standing_book.macro
        : null,
    compiled_minus_side_coach:
      cells[family].compiled_constraint.macro !== null && cells[family].side_coach.macro !== null
        ? cells[family].compiled_constraint.macro - cells[family].side_coach.macro
        : null,
  };
}

// ---- report ----
const fmt = (v, d = 3) => (v === null || v === undefined ? 'n/a' : Number(v).toFixed(d));
console.log(`Step 4 frozen compliance analysis — detector ${DETECTOR_VERSION}`);
console.log(`Sealed ${sealedRows.length}/80; excluded ${excluded.length}`);
for (const d of excluded) console.log(`  EXCLUDED ${d.job.id}: ${d.reason}`);
const violations = sealedRows.filter((d) => d.windowViolations.length);
if (violations.length)
  for (const d of violations) console.log(`  WINDOW VIOLATION ${d.job.id}: turns ${d.windowViolations.join(',')}`);

for (const family of FAMILIES) {
  console.log(`\n=== ${family} ===`);
  console.log('arm | n | T1 opp/comp (rate) | T2 opp/comp (rate) | macro | density | cov@16 | safety | leaks(full)');
  for (const arm of ARMS) {
    const c = cells[family][arm];
    const leaks = c.fullLeaksByDialogue.reduce((s, d) => s + d.leaks, 0);
    console.log(
      `${arm} | ${c.n} | ${c.stagnant_repeat.opp}/${c.stagnant_repeat.comp} (${fmt(c.stagnant_repeat.rate)}) | ` +
        `${c.warrant_skip.opp}/${c.warrant_skip.comp} (${fmt(c.warrant_skip.rate)}) | ${fmt(c.macro)} | ` +
        `${c.densityPass ? 'PASS' : 'FAIL'} | ${fmt(c.meanCoverage)} | ${fmt(c.safetyPassRate, 2)} | ${leaks}`,
    );
  }
  for (const arm of TREATMENTS) {
    const r = results[family][arm];
    console.log(`\n${arm} - triggered_placebo:`);
    console.log(
      `  macro diff ${fmt(r.macroDiff)} (need >= +0.15) | CI95 [${r.bootstrap.ci95 ? r.bootstrap.ci95.map((v) => fmt(v)).join(', ') : 'n/a'}] | ` +
        `T1 diff ${fmt(r.triggerDiffs.stagnant_repeat)} T2 diff ${fmt(r.triggerDiffs.warrant_skip)}`,
    );
    console.log(
      `  conditions: ${Object.entries(r.conditions)
        .map(([k, v]) => `${k}=${v ? 'PASS' : 'FAIL'}`)
        .join(' ')}`,
    );
    console.log(
      `  guardrails: coverage=${r.guardrails.coverage_within_margin ? 'PASS' : 'FAIL'} safety=${r.guardrails.safety_within_margin ? 'PASS' : 'FAIL'} ` +
        `zeroLeaks=${r.guardrails.zero_leaks_every_treatment_dialogue ? 'PASS' : 'FAIL'} noNewGuardCat=${r.guardrails.no_new_guard_category ? 'PASS' : 'FAIL'}` +
        (r.guardrails.new_categories.length ? ` NEW=[${r.guardrails.new_categories.join(',')}]` : ''),
    );
    console.log(
      `  VERDICT: ${r.pass ? 'PASS' : 'FAIL'} (compliance ${r.compliancePass ? 'pass' : 'fail'}, guardrails ${r.guardrailPass ? 'pass' : 'fail'})`,
    );
  }
  console.log(
    `secondary: side_coach-standing_book ${fmt(results[family].secondary.side_coach_minus_standing_book)}, ` +
      `compiled-side_coach ${fmt(results[family].secondary.compiled_minus_side_coach)}`,
  );
}

// two-family grammar
console.log('\n=== §8 decision grammar ===');
for (const arm of TREATMENTS) {
  const passes = FAMILIES.filter((f) => results[f][arm].pass);
  if (passes.length === 2)
    console.log(`${arm}: PASSES BOTH FAMILIES — two-family point-of-action mechanism confirmation`);
  else if (passes.length === 1)
    console.log(`${arm}: passes ${passes[0]} only — family-bounded mechanism; no general claim`);
  else console.log(`${arm}: passes neither family`);
}

if (JSON_OUT) {
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.step4-compliance-analysis.v1',
        detectorVersion: DETECTOR_VERSION,
        bootstrap: { draws: BOOT_DRAWS, seed: BOOT_SEED },
        sealed: sealedRows.length,
        excluded: excluded.map((d) => ({ id: d.job.id, reason: d.reason })),
        cells,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nJSON written: ${JSON_OUT}`);
}
