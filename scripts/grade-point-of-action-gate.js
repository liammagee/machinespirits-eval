#!/usr/bin/env node
// Grade the point-of-action gate's decisions against proof-DAG advancement.
//
// The gap this fills: `auditTutorStubPointOfActionCompliance` scores the writer
// (did the tutor obey the side-coach block), and nothing scored the gate (was
// intervening the right call here). Without a gate scorer a local model for the
// *when to intervene* seat cannot be evaluated against the frontier classifier
// even given a perfect label corpus, because there is no channel to compare them
// on.
//
// Everything here reads archived traces. Zero API calls, zero cost, and it can be
// re-run on any future archive with the same record types.
//
//   node scripts/grade-point-of-action-gate.js
//   node scripts/grade-point-of-action-gate.js --archive ~/.machinespirits-data/program-2
//   node scripts/grade-point-of-action-gate.js --json out.json --per-persona
//
// See services/pointOfActionGateGrader.js for what the numbers mean and what the
// arm design does and does not identify.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POINT_OF_ACTION_GATE_GRADE_SCHEMA,
  OBSERVATIONAL_ARMS,
  INJECTING_ARMS,
  WARRANT_ALIGNED_FIELD,
  CANDIDATE_GATE_POLICIES,
  buildGateDecisions,
  checkGateGradeIntegrity,
  dagProgressState,
  isCleanDecision,
  isWindowEligible,
  scoreAlternativeGate,
  summarizeGateArm,
  summarizeTreatment,
} from '../services/pointOfActionGateGrader.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const DEFAULT_ARCHIVES = [
  path.join(os.homedir(), '.machinespirits-data', 'step4-claim-runs-2026-07'),
  path.join(os.homedir(), '.machinespirits-data', 'program-2'),
];

function expandHome(value) {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function parseArgs(argv) {
  const options = { archives: [], json: null, perPersona: false, minTurns: 3, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      index += 1;
      return value;
    };
    if (argument === '--archive') options.archives.push(expandHome(next()));
    else if (argument === '--json') options.json = expandHome(next());
    else if (argument === '--per-persona') options.perPersona = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--min-turns') options.minTurns = Number.parseInt(next(), 10);
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument ${JSON.stringify(argument)}`);
  }
  if (options.archives.length === 0) options.archives = DEFAULT_ARCHIVES.filter((dir) => fs.existsSync(dir));
  return options;
}

// Trace files live at <archive>/**/traces/<run>/<timestamp>.jsonl. Walk rather
// than glob so both archive layouts work unchanged — step4 keeps `traces/` at the
// root, program-2 nests it one level down under each phase.
function findTraceFiles(root) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip the build and model trees; they are large and hold no traces.
        if (['llama.cpp', 'venv', 'models', 'node_modules', '.git'].includes(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl') && path.basename(dir) !== 'traces') {
        if (full.includes(`${path.sep}traces${path.sep}`)) found.push(full);
      }
    }
  };
  walk(root, 0);
  return found.sort();
}

function readTrace(file) {
  const records = [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return records;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // A truncated final line is normal for a run that was interrupted; the
      // turns before it are still valid observations.
    }
  }
  return records;
}

function personaFromPath(file) {
  const dir = path.basename(path.dirname(file));
  const match = dir.match(
    /(proof_skipper|affective_resistant|[a-z_]+?)-(?:standing_book|triggered_placebo|side_coach|compiled_constraint|committee|silent_control)/u,
  );
  return match ? match[1] : null;
}

function phaseFromPath(file, archive) {
  const relative = path.relative(archive, file);
  const first = relative.split(path.sep)[0];
  return first === 'traces' ? path.basename(archive) : first;
}

function buildDialogue(file, archive) {
  const records = readTrace(file);
  if (records.length === 0) return null;
  const turnStates = new Map();
  const turnHygiene = new Map();
  const assignments = [];
  let runId = null;
  for (const record of records) {
    if (!runId && record.runId) runId = record.runId;
    if (record.type === 'turn_complete') {
      const state = dagProgressState(record);
      if (state && state.turn !== null) turnStates.set(state.turn, state);
    } else if (record.type === 'point_of_action_assignment') {
      assignments.push(record);
    } else if (record.type === 'tutor_response_guard_accounting') {
      const turn = Number(record.turn ?? record.accounting?.turn);
      if (!Number.isFinite(turn)) continue;
      const accounting = record.accounting || {};
      turnHygiene.set(turn, {
        // Three separate things, and only the first is grounds for exclusion.
        //
        // `finalDelivery` is the text the learner actually read. A failing leak
        // audit there means the answer reached them, so any advance that follows
        // may be the leak's rather than the learner's.
        //
        // `originalCandidate` is the tutor's first draft. A failing audit there is
        // the guard catching a leak before delivery — the system working. It is
        // also redundant with `outcome`, since a failing draft audit is why the
        // guard intervened, so excluding on it would double-count.
        //
        // `guards.leak` reports only that the guard was ENABLED, not that anything
        // leaked; it is never read here.
        deliveryLeaked: accounting.finalDelivery?.audits?.leakAudit?.ok === false,
        draftLeaked: accounting.originalCandidate?.audits?.leakAudit?.ok === false,
        fallback: String(accounting.outcome || '').includes('fallback'),
      });
    }
  }
  const decisions = buildGateDecisions({ assignments, turnStates, turnHygiene });
  return {
    file,
    runId,
    phase: phaseFromPath(file, archive),
    persona: personaFromPath(file),
    arm: decisions[0]?.arm || null,
    turns: turnStates.size,
    decisions,
  };
}

// A run directory can hold more than one trace file when a run was restarted.
// Keep the longest per runId so a partial first attempt does not double-count its
// early turns alongside the completed attempt.
function dedupeDialogues(dialogues) {
  const best = new Map();
  const dropped = [];
  for (const dialogue of dialogues) {
    const key = dialogue.runId || dialogue.file;
    const incumbent = best.get(key);
    if (!incumbent) {
      best.set(key, dialogue);
      continue;
    }
    if (dialogue.decisions.length > incumbent.decisions.length) {
      best.set(key, dialogue);
      dropped.push(incumbent);
    } else {
      dropped.push(dialogue);
    }
  }
  return { kept: [...best.values()], dropped };
}

function formatCell(cell) {
  if (!cell || !cell.total) return '     n/a';
  return `${(cell.rate * 100).toFixed(1)}% ${String(`(${cell.advanced}/${cell.total})`).padStart(9)}`;
}

function formatDifference(difference) {
  if (difference?.delta === null || difference?.delta === undefined) return 'n/a';
  const points = (difference.delta * 100).toFixed(1);
  const z = difference.z === null ? 'n/a' : difference.z.toFixed(2);
  return `${points >= 0 ? '+' : ''}${points} pts  (SE ${(difference.se * 100).toFixed(1)}, z ${z})`;
}

/**
 * Load and grade an archive without printing anything.
 *
 * Exported so a post-run pipeline can check its own output root in-process rather
 * than reimplementing this walk — which is easy to get subtly wrong (the trace
 * filter, the restart dedupe and the hygiene record shape are all load-bearing) and
 * silently returns zero rows when it is.
 */
export function loadGateDecisions({ archives = [], minTurns = 3 } = {}) {
  const dialogues = [];
  for (const archive of archives) {
    for (const file of findTraceFiles(archive)) {
      const dialogue = buildDialogue(file, archive);
      if (dialogue && dialogue.turns >= minTurns) dialogues.push(dialogue);
    }
  }
  const { kept, dropped } = dedupeDialogues(dialogues);
  const decisions = kept.flatMap((dialogue) =>
    dialogue.decisions.map((decision) => ({ ...decision, phase: dialogue.phase, persona: dialogue.persona })),
  );
  const arms = [...new Set(decisions.map((row) => row.arm).filter(Boolean))].sort();
  const armSummaries = arms.map((arm) =>
    summarizeGateArm(
      arm,
      decisions.filter((row) => row.arm === arm),
    ),
  );
  return {
    kept,
    dropped,
    decisions,
    armSummaries,
    integrity: checkGateGradeIntegrity({ decisions, armSummaries }),
  };
}

function report(options) {
  const { kept, dropped, decisions, armSummaries, integrity } = loadGateDecisions(options);

  console.log(`archives: ${options.archives.join(', ')}`);
  console.log(`dialogues: ${kept.length}${dropped.length ? ` (${dropped.length} superseded restart(s) dropped)` : ''}`);
  console.log(`gate decisions with a scorable next turn: ${decisions.length}`);
  const clean = decisions.filter(isCleanDecision);
  console.log(
    `  clean: ${clean.length}   excluded: ${decisions.filter((row) => row.deliveryLeaked).length} delivered leaked text`,
  );
  console.log(
    `  carried as covariates, not excluded: ${clean.filter((row) => row.draftLeaked).length} first-draft leak ` +
      `caught by the guard, ${clean.filter((row) => row.fallback).length} deterministic fallback`,
  );

  const arms = armSummaries.map((summary) => summary.arm);

  console.log('');
  console.log(`Advance rate after each gate decision, on the warrant-aligned outcome (${WARRANT_ALIGNED_FIELD})`);
  console.log("(advance = the learner voiced a derivation that validated against the world's rule closure)");
  console.log('');
  console.log(
    `  ${'arm'.padEnd(21)} ${'obs'.padEnd(4)} ${'fire rate'.padEnd(11)} ${'gate fired'.padEnd(18)} ` +
      `${'gate silent'.padEnd(18)} discrimination`,
  );
  for (const summary of armSummaries) {
    const aligned = summary.outcomes[WARRANT_ALIGNED_FIELD];
    console.log(
      `  ${summary.arm.padEnd(21)} ${(summary.observational ? 'yes' : 'no').padEnd(4)} ` +
        `${`${(summary.covariates.fireRate.rate * 100).toFixed(1)}%`.padEnd(11)} ` +
        `${formatCell(aligned.fired).padEnd(18)} ${formatCell(aligned.silent).padEnd(18)} ` +
        `${formatDifference(aligned.discrimination)}`,
    );
  }
  console.log('');
  console.log('  obs = the gate logs its decision but injects nothing, so the flagged-vs-silent');
  console.log('        gap on those rows is a property of the gate rather than of a treatment.');
  console.log('  discrimination = silent advance rate minus fired advance rate. Positive means the');
  console.log('        gate is picking out moments where the learner was in fact about to stall.');
  console.log("  fire rate = share of that arm's scorable turns the gate flagged. The arms differ here,");
  console.log('        so their flagged pools differ in composition and not only in treatment.');

  // The other two DAG components, shown separately and labelled, because the
  // warrant intervention forbids the tutor move they depend on. Pooling them into
  // one "advanced" flag reads that instruction as a failure to help.
  console.log('');
  console.log('Same decisions on the tutor-gated components, which the intervention suppresses by design');
  console.log('');
  console.log(`  ${'arm'.padEnd(21)} ${'grounded fired/silent'.padEnd(30)} ${'coverage fired/silent'.padEnd(30)}`);
  for (const summary of armSummaries) {
    const cellPair = (field) => {
      const outcome = summary.outcomes[field];
      return `${(outcome.fired.rate * 100 || 0).toFixed(1)}% / ${(outcome.silent.rate * 100 || 0).toFixed(1)}%`;
    };
    console.log(`  ${summary.arm.padEnd(21)} ${cellPair('grounded').padEnd(30)} ${cellPair('coverage').padEnd(30)}`);
  }
  console.log('');
  console.log('  `grounded` counts learner-held premises and `coverage` is computed over them, so both');
  console.log('  move only when the tutor releases a premise the learner adopts. The warrant_skip');
  console.log('  constraint sets suppress_new_premise: true, and compiled_constraint enforces that');
  console.log('  programmatically rather than by asking. A low fired rate in that row is the');
  console.log('  instruction, not a verdict on the gate.');

  const observational = armSummaries.filter((summary) => summary.observational);
  const observationalArmNames = observational.map((summary) => summary.arm);
  const mismatches = armSummaries.filter((summary) => summary.armClassificationMismatch);
  if (mismatches.length > 0) {
    console.log('');
    console.log('  NOTE: arm classification derived from the traces differs from the declared list for:');
    for (const summary of mismatches) {
      console.log(
        `    ${summary.arm}: declared ${summary.declaredObservational ? 'observational' : 'injecting'}, ` +
          `observed ${summary.observational ? 'observational' : 'injecting'} ` +
          `(${summary.injectedOnFired} fired turns carried injected text)`,
      );
    }
  }
  if (observational.length > 0) {
    const pooled = summarizeGateArm(
      observationalArmNames[0],
      decisions.filter((row) => observationalArmNames.includes(row.arm)),
    );
    const aligned = pooled.outcomes[WARRANT_ALIGNED_FIELD];
    console.log('');
    console.log(`Gate as a detector, pooled over observational arms (${observational.map((s) => s.arm).join(' + ')})`);
    console.log(`  flagged moments that advanced anyway: ${aligned.fired.advanced}/${aligned.fired.total}`);
    console.log(`  passed-over moments that advanced:    ${aligned.silent.advanced}/${aligned.silent.total}`);
    console.log(`  discrimination: ${formatDifference(aligned.discrimination)}`);
    console.log(
      `  by trigger — warrant_skip ${formatCell(pooled.byTrigger.warrant_skip)}, ` +
        `stagnant_repeat ${formatCell(pooled.byTrigger.stagnant_repeat)}`,
    );
    console.log(`  suppressed (would have fired, held back): ${formatCell(pooled.suppressed)}`);
    console.log('');
    console.log('  Every outcome component, pooled. No treatment is in the way on these arms, so each');
    console.log("  row is the gate's discriminative power on that measure and nothing else.");
    for (const key of ['voicedDerived', 'grounded', 'coverage', 'any']) {
      const outcome = pooled.outcomes[key];
      const label = outcome.tutorGated ? `${key} (tutor-gated)` : key;
      console.log(
        `    ${label.padEnd(24)} fired ${formatCell(outcome.fired).padEnd(19)} ` +
          `silent ${formatCell(outcome.silent).padEnd(19)} ${formatDifference(outcome.discrimination)}`,
      );
    }
  }

  const decisionsByArm = new Map(arms.map((arm) => [arm, decisions.filter((row) => row.arm === arm)]));
  const treatment = summarizeTreatment(decisionsByArm);
  if (treatment.length > 0) {
    console.log('');
    console.log(
      `Did acting on flagged moments help? (injecting arm vs observational, flagged moments, ${WARRANT_ALIGNED_FIELD})`,
    );
    for (const row of treatment) {
      console.log(
        `  ${row.arm.padEnd(21)} ${formatCell(row.treated)}` +
          `  vs baseline ${(row.baseline.rate * 100).toFixed(1)}%  ->  ${formatDifference(row.effect)}`,
      );
    }
    console.log('');
    console.log('  Deterministic-fallback turns are dropped here: the tutor delivered a canned reply');
    console.log('  instead of the model candidate, so the intervention did not land as written.');
    console.log('  Between-arm, not within-dialogue: the arms ran as separate dialogues, so these are');
    console.log('  different moments, drawn at different fire rates. It answers whether intervening at');
    console.log('  gate-selected moments raises the advance rate, not whether any turn would have gone');
    console.log('  better.');
  }

  // A worked example of the off-policy channel: score the gate's own rule and one
  // narrower alternative over the same moments, so the report demonstrates what a
  // candidate local policy would be measured against.
  const observationalDecisions = decisions.filter((row) => observationalArmNames.includes(row.arm));
  if (observationalDecisions.length > 0) {
    const policies = {
      'live rule (omits_warrant + overleaps_evidence)': (row) => row.fired,
      'omits_warrant only': (row) => row.evidenceUse === 'omits_warrant',
      'overleaps_evidence only': (row) => row.evidenceUse === 'overleaps_evidence',
      'never fire': () => false,
      'always fire': () => true,
    };
    console.log('');
    console.log('Off-policy comparison of gate rules on the observational moments');
    console.log(`  ${'policy'.padEnd(46)} ${'fires'.padEnd(6)} ${'stall precision'.padEnd(17)} silence accuracy`);
    for (const [label, policy] of Object.entries(policies)) {
      const score = scoreAlternativeGate(observationalDecisions, policy);
      const precision = formatCell(score.stallPrecision);
      const accuracy = formatCell(score.silenceAccuracy);
      console.log(`  ${label.padEnd(46)} ${String(score.firesOn).padEnd(6)} ${precision.padEnd(17)} ${accuracy}`);
    }
    console.log('');
    console.log('  stall precision  = of the moments a policy flags, the share that did stall.');
    console.log('  silence accuracy = of the moments it passes over, the share that did advance.');
    console.log('  Off-policy: the outcomes are the ones that followed the gate that actually ran, so');
    console.log('  this ranks how well a rule PREDICTS stalls. It cannot say what a rule would CAUSE.');

    // Same channel, restricted to turns a gate could actually fire on, and split so
    // the model's vote and the deterministic position layer are scored apart. The
    // table above keeps its whole-population denominator because its numbers are
    // cited; this one is the deployable comparison.
    const eligible = observationalDecisions.filter(isWindowEligible);
    console.log('');
    console.log('Same channel, restricted to the [3, 24] trigger window, with the gate split into its halves');
    console.log(`  ${'policy'.padEnd(46)} ${'fires'.padEnd(12)} ${'stall precision'.padEnd(17)} silence accuracy`);
    for (const [label, policy] of Object.entries(CANDIDATE_GATE_POLICIES)) {
      const score = scoreAlternativeGate(eligible, policy);
      const share = score.n ? ((100 * score.firesOn) / score.n).toFixed(0) : '0';
      console.log(
        `  ${label.padEnd(46)} ${`${score.firesOn} (${share}%)`.padEnd(12)} ` +
          `${formatCell(score.stallPrecision).padEnd(17)} ${formatCell(score.silenceAccuracy)}`,
      );
    }
    console.log('');
    console.log(`  n = ${eligible.length} window-eligible observational moments.`);
    console.log('  The live rule is the conjunction of the two rows above it. Splitting them says which');
    console.log('  half carries the decision — the paid per-turn vote, or the position flag the tutor');
    console.log('  already computes. A policy firing on a much larger share of turns is a different');
    console.log('  intervention regime and not a drop-in swap, whatever its precision.');
  }

  if (options.perPersona) {
    const personas = [...new Set(decisions.map((row) => row.persona).filter(Boolean))].sort();
    console.log('');
    console.log('By learner persona (observational arms only)');
    for (const persona of personas) {
      const rows = observationalDecisions.filter((row) => row.persona === persona);
      if (rows.length === 0) continue;
      const aligned = summarizeGateArm(observationalArmNames[0], rows).outcomes[WARRANT_ALIGNED_FIELD];
      console.log(
        `  ${persona.padEnd(21)} fired ${formatCell(aligned.fired).padEnd(18)} ` +
          `silent ${formatCell(aligned.silent).padEnd(18)} ${formatDifference(aligned.discrimination)}`,
      );
    }
  }

  if (options.json) {
    const eligible = observationalDecisions.filter(isWindowEligible);
    const payload = {
      schema: POINT_OF_ACTION_GATE_GRADE_SCHEMA,
      archives: options.archives,
      dialogues: kept.length,
      decisions: decisions.length,
      clean: clean.length,
      warrantAlignedField: WARRANT_ALIGNED_FIELD,
      arms: armSummaries,
      treatment,
      observationalArms: observationalArmNames,
      declaredObservationalArms: OBSERVATIONAL_ARMS,
      declaredInjectingArms: INJECTING_ARMS,
      windowEligiblePolicies: Object.fromEntries(
        Object.entries(CANDIDATE_GATE_POLICIES).map(([label, policy]) => [
          label,
          scoreAlternativeGate(eligible, policy),
        ]),
      ),
      integrity,
    };
    fs.mkdirSync(path.dirname(path.resolve(options.json)), { recursive: true });
    fs.writeFileSync(path.resolve(options.json), `${JSON.stringify(payload, null, 2)}\n`);
    console.log('');
    console.log(`wrote ${options.json}`);
  }

  return { count: decisions.length, integrity };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message || error));
    process.exit(1);
  }
  if (options.help) {
    console.log(
      'Usage: node scripts/grade-point-of-action-gate.js [--archive DIR]... [--json FILE] [--per-persona] [--check]',
    );
    console.log('');
    console.log("Scores the point-of-action gate's decisions (when to intervene) against proof-DAG");
    console.log('advancement on the following turn. Reads archived traces only; no API calls.');
    console.log('');
    console.log('  --check   exit non-zero on a structural failure (record shape drift, an unrecognised');
    console.log('            arm, an arm that injects where it was declared observational, no scorable');
    console.log('            decisions). Fails on structure only, never on a number.');
    return;
  }
  if (options.archives.length === 0) {
    // Under --check this is a failure: a post-run gate that silently passes when it
    // was pointed at nothing is worse than no gate.
    const message = 'No archive found. Pass --archive DIR pointing at a run archive containing traces/.';
    if (options.check) {
      console.error(message);
      process.exit(1);
    }
    console.log(message);
    return;
  }
  const { count, integrity } = report(options);
  if (count === 0) {
    console.log('');
    console.log('No scorable gate decisions found. The archive needs point_of_action_assignment records');
    console.log('and turn_complete records carrying a stateObservation.dag block.');
  }
  for (const warning of integrity.warnings) {
    console.log('');
    console.log(`NOTE [${warning.code}] ${warning.detail}`);
  }
  if (!options.check) return;
  console.log('');
  if (integrity.ok) {
    console.log(`--check PASS: ${count} scorable decisions, arm classification matches the declared design.`);
    return;
  }
  for (const failure of integrity.failures) {
    console.error(`--check FAIL [${failure.code}] ${failure.detail}`);
  }
  process.exit(1);
}

// Guarded so `loadGateDecisions` can be imported by a post-run check without the
// import running the CLI.
if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) main();
