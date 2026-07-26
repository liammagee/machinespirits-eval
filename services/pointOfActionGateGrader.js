// Grades the point-of-action gate's *decisions* — whether intervening was the
// right call — against a downstream outcome the gate cannot author.
//
// This is a different question from the one `auditTutorStubPointOfActionCompliance`
// answers. That audit grades the writer: given that the gate fired and the
// side-coach block was injected, did the tutor do what the block asked (exactly
// one question, a warrant cue, no new premise, guards passed)? A tutor can score
// a perfect 4/4 on a turn where intervening was pointless. Nothing in the stack
// scored the gate itself, which is why a local model for the *when to intervene*
// seat could not be evaluated even with a perfect label corpus.
//
// The outcome used here is the learner's movement through the world's proof DAG:
// `best_path_coverage`, `grounded_count`, `voiced_derived_count`. These are
// computed by validating extracted learner claims against the world's rule
// closure, so a learner gets credit only for a fact that actually follows. The
// gate has no channel to inflate them, which is what makes them usable as a
// scoring channel rather than a second opinion from the same instrument.
//
// The three fields are not interchangeable, and the difference decides what can
// be claimed. Two of them are tutor-gated and the intervention under study
// suppresses the tutor move they depend on; only `voiced_derived_count` is
// learner-owned. See TUTOR_GATED_FIELDS below — that distinction is the
// difference between a gate finding and an artifact of the instruction.
//
// Identification rests on one property of the arm design. `standing_book`,
// `silent_control` and `committee` compute and log the assignment and then inject
// nothing at trigger time, so on those arms the gate's decision has no causal
// effect on the dialogue. That makes them observational: comparing what happens
// after moments the gate flagged against moments it passed over measures whether
// the gate is detecting real trouble, with no treatment in the way. The injecting
// arms then say whether acting on those moments pays.
//
// That property is verified per run rather than assumed — see OBSERVATIONAL_ARMS
// and `isObservationalArm`.

export const POINT_OF_ACTION_GATE_GRADE_SCHEMA = 'machinespirits.tutor-stub.point-of-action-gate-grade.v1';

// Arms expected to log an assignment and never inject at trigger time. On these
// the gate is a pure observer, so a difference between flagged and passed-over
// moments is a property of the gate rather than of any intervention.
//
// Some of these arms do change tutor behaviour — `standing_book` carries craft
// guidance in its opening prompt, `committee` runs a different writer
// architecture — but that text is present on every turn regardless of what the
// gate decides, so it is a per-arm constant and cannot confound a within-arm
// flagged-vs-passed comparison.
//
// This list is a declared expectation, not the operative test. `summarizeGateArm`
// derives `observational` from the traces themselves: an arm is observational when
// no fired turn in the data carried interruption text. That way the identifying
// assumption is checked per run rather than assumed, and a new arm or a changed
// injection path shows up as `armClassificationMismatch` instead of quietly
// entering the baseline.
export const OBSERVATIONAL_ARMS = Object.freeze(['standing_book', 'silent_control', 'committee']);

// Arms that inject at trigger time. `triggered_placebo` injects target-free text
// of matched length, so it holds timing and length fixed and varies only content.
export const INJECTING_ARMS = Object.freeze(['triggered_placebo', 'side_coach', 'compiled_constraint']);

const PROGRESS_FIELDS = Object.freeze(['coverage', 'grounded', 'voicedDerived']);

// Two of the three progress fields can only move when the tutor releases a
// premise the learner then adopts: `grounded` counts learner-held premises and
// `coverage` is computed over them. The `warrant_skip` intervention forbids
// exactly that — the constraint it compiles sets `suppress_new_premise: true` —
// so on a treated firing turn those two fields are mechanically held down by the
// intervention's own instruction. Reading a low advance rate there as "the gate
// picked bad moments" would be reading the instruction, not the gate.
//
// `voicedDerived` counts facts the learner derived out loud and had validated
// against the world's rule closure. That is what a warrant intervention is asking
// for, so it is the warrant-aligned outcome and the one this grader leads with.
// It is the least tutor-gated of the three, not ungated: a derivation still needs
// premises, so cutting premise supply depresses it too. `compiled_constraint` —
// the arm that enforces `suppress_new_premise` programmatically rather than asking
// for it in text — falls on all three fields, which is why no field makes that arm
// safe to read as a gate result.
const TUTOR_GATED_FIELDS = Object.freeze(['coverage', 'grounded']);
export const WARRANT_ALIGNED_FIELD = 'voicedDerived';

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Pull the proof-DAG progress state out of a `turn_complete` record.
 *
 * Returns null when the record carries no DAG block at all. A turn with a DAG
 * block but a missing individual field keeps the null for that field rather than
 * coercing to 0, because 0 is a real coverage value and treating "not observed"
 * as "no progress" would invent stalls.
 */
export function dagProgressState(turnCompleteRecord) {
  const dag = turnCompleteRecord?.turnRecord?.stateObservation?.dag;
  if (!dag || typeof dag !== 'object') return null;
  return {
    turn: finiteNumber(turnCompleteRecord?.turn ?? turnCompleteRecord?.turnRecord?.turn),
    coverage: finiteNumber(dag.best_path_coverage ?? dag.bestPathCoverage),
    grounded: finiteNumber(dag.grounded_count ?? dag.groundedCount),
    voicedDerived: finiteNumber(dag.voiced_derived_count ?? dag.voicedDerivedCount),
    unsupported: finiteNumber(dag.unsupported_assertion_count ?? dag.unsupportedAssertionCount),
    missingPremise: finiteNumber(dag.missing_premise_count ?? dag.missingPremiseCount),
  };
}

/**
 * Did the learner move forward between two consecutive observations?
 *
 * The window is state(N+1) − state(N), which is the right one: the state at turn
 * N is the analysis of the learner's turn-N message, and the tutor's turn-N reply
 * comes after it, so the learner's response to that reply is what lands at N+1.
 *
 * `advanced` is the disjunction of the three progress fields. Each component is
 * reported separately as well, because they are not interchangeable — coverage is
 * the headline but moves in coarse steps, while `voicedDerived` is the one that
 * speaks most directly to a warrant intervention (it counts facts the learner
 * derived out loud rather than merely held).
 */
export function advanceOutcome(before, after) {
  if (!before || !after) return null;
  const deltas = {};
  let observed = 0;
  for (const field of PROGRESS_FIELDS) {
    if (before[field] === null || after[field] === null) {
      deltas[field] = null;
      continue;
    }
    deltas[field] = Number((after[field] - before[field]).toFixed(6));
    observed += 1;
  }
  if (observed === 0) return null;
  const positives = PROGRESS_FIELDS.filter((field) => deltas[field] !== null && deltas[field] > 0);
  const negatives = PROGRESS_FIELDS.filter((field) => deltas[field] !== null && deltas[field] < 0);
  return {
    deltas,
    advanced: positives.length > 0,
    // Tracked but never folded into `advanced`. A retraction is not a stall, and
    // conflating them would hide the case where an intervention actively undid
    // learner-held ground.
    regressed: negatives.length > 0,
    advancedOn: positives,
  };
}

/**
 * Wilson score interval. Used instead of the normal approximation because the
 * per-cell counts here run to a few dozen at low rates, where the textbook
 * interval can reach below zero and misstate how much a comparison can carry.
 */
export function wilsonInterval(successes, total, z = 1.96) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return { rate: null, low: null, high: null, n: 0 };
  const k = Number(successes);
  const rate = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = rate + (z * z) / (2 * n);
  const spread = z * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n));
  return {
    rate: Number(rate.toFixed(4)),
    low: Number(Math.max(0, (centre - spread) / denominator).toFixed(4)),
    high: Number(Math.min(1, (centre + spread) / denominator).toFixed(4)),
    n,
  };
}

/**
 * Difference of two independent proportions with a standard error, reported as a
 * z score rather than a p value. The point of the z is to say whether a gap is
 * separable from zero at the available n, not to license a significance claim —
 * these are archived observational moments, not a pre-registered contrast.
 */
export function proportionDifference(aSuccesses, aTotal, bSuccesses, bTotal) {
  if (!aTotal || !bTotal) return { delta: null, se: null, z: null };
  const pA = aSuccesses / aTotal;
  const pB = bSuccesses / bTotal;
  const se = Math.sqrt((pA * (1 - pA)) / aTotal + (pB * (1 - pB)) / bTotal);
  const delta = pA - pB;
  return {
    delta: Number(delta.toFixed(4)),
    se: Number(se.toFixed(4)),
    z: se > 0 ? Number((delta / se).toFixed(3)) : null,
  };
}

/**
 * Turn one dialogue's trace records into one row per gate decision.
 *
 * Every logged assignment becomes a row, fired or not — the passed-over moments
 * are half the measurement, since a gate that never fires scores perfectly on
 * the fired moments alone. Rows drop out only when the next turn's observation is
 * missing, which is the final turn of each dialogue and any turn whose DAG block
 * failed to record.
 */
export function buildGateDecisions({ assignments = [], turnStates = new Map(), turnHygiene = new Map() } = {}) {
  const decisions = [];
  for (const assignment of assignments) {
    const poa = assignment?.pointOfAction;
    if (!poa) continue;
    const turn = finiteNumber(assignment.turn ?? poa.turn);
    if (turn === null) continue;
    const before = turnStates.get(turn);
    const after = turnStates.get(turn + 1);
    const outcome = advanceOutcome(before, after);
    if (!outcome) continue;
    const hygiene = turnHygiene.get(turn) || {};
    const evidenceUse = poa.inputs?.evidence_use ?? null;
    const suppression = poa.suppression || {};
    // A moment the gate would have fired on but held back. Worth its own label:
    // these are decisions too, and a grader that ignored them would credit the
    // suppression rules to the trigger logic or vice versa.
    const suppressed =
      !poa.assigned_trigger &&
      (['omits_warrant', 'overleaps_evidence'].includes(String(evidenceUse || '')) ||
        Boolean(poa.candidates?.stagnant_repeat)) &&
      Object.values(suppression).some(Boolean);
    decisions.push({
      turn,
      arm: poa.arm || null,
      fired: Boolean(poa.assigned_trigger),
      trigger: poa.assigned_trigger || null,
      cofire: Boolean(poa.cofire),
      evidenceUse,
      suppressed,
      injected: Boolean(poa.interruption?.text),
      advanced: outcome.advanced,
      regressed: outcome.regressed,
      advancedOn: outcome.advancedOn,
      deltas: outcome.deltas,
      deliveryLeaked: hygiene.deliveryLeaked === true,
      draftLeaked: hygiene.draftLeaked === true,
      fallback: hygiene.fallback === true,
    });
  }
  return decisions;
}

/**
 * Should this decision count at all?
 *
 * One exclusion: the text the learner actually read leaked the answer. There the
 * observed advance may be the leak's work rather than the learner's, so the
 * outcome is not interpretable whatever the gate decided.
 *
 * Two things deliberately do NOT exclude a row.
 *
 * A leak in the tutor's *first draft* is the guard working, not a contaminated
 * turn — it was caught and the text was repaired or replaced before delivery. In
 * this archive it never survives to delivery on a repaired turn (0 of 300) and
 * survives on 41 of 768 fallback turns. Excluding first-draft leaks would drop
 * ~390 clean turns and would double-count the guard outcome, since a failing draft
 * audit is precisely why the guard intervened. It is carried as a covariate.
 *
 * A deterministic fallback is a different tutor policy — the model's candidate was
 * discarded for a canned reply — so the injection did not land as written. That
 * matters for the treatment contrast and not for the detector question, because on
 * the observational arms nothing was being injected in the first place. So it gates
 * `isTreatmentEligible` and not this.
 */
export function isCleanDecision(decision) {
  return !decision.deliveryLeaked;
}

/**
 * Extra condition for the between-arm treatment contrast: the intervention has to
 * have actually reached the learner as written.
 */
export function isTreatmentEligible(decision) {
  return isCleanDecision(decision) && !decision.fallback;
}

/**
 * Is this arm observational with respect to the gate? Derived from the traces: no
 * firing on this arm produced injected text. Falls back to the declared list only
 * when the arm never fired, where the data cannot answer.
 */
export function isObservationalArm(arm, decisions) {
  const fired = decisions.filter((row) => row.fired);
  if (fired.length === 0) return OBSERVATIONAL_ARMS.includes(arm);
  return fired.every((row) => !row.injected);
}

function advancedOnField(row, field) {
  if (field === null) return row.advanced;
  const delta = row.deltas?.[field];
  return typeof delta === 'number' && delta > 0;
}

function cell(decisions, predicate, field = null) {
  const rows = decisions.filter(predicate);
  const advanced = rows.filter((row) => advancedOnField(row, field)).length;
  return { ...wilsonInterval(advanced, rows.length), advanced, total: rows.length };
}

/**
 * The gate-discrimination measure, computed within one arm and separately for each
 * outcome field.
 *
 * On an observational arm this is the whole question: of the moments the gate
 * flagged, how often did the learner move anyway, and how often did they move
 * after moments it passed over? A gate that detects genuine trouble should show
 * LOWER advancement on flagged moments, because it is picking out turns where the
 * learner is stuck. `discrimination` is therefore signed so that positive means
 * the gate is discriminating in the expected direction.
 *
 * On an injecting arm the same numbers are not a detector measure, because the
 * flagged moments were treated and the passed-over ones were not. The caller is
 * responsible for that distinction; `observational` records which case this is.
 *
 * `outcomes` is keyed by field, each carrying `tutorGated` so a consumer cannot
 * read a suppressed component as a gate result by accident. `warrantAligned` names
 * the field to lead with.
 */
export function summarizeGateArm(arm, decisions) {
  const clean = decisions.filter(isCleanDecision);
  const outcomes = {};
  for (const field of [...PROGRESS_FIELDS, null]) {
    const key = field === null ? 'any' : field;
    const fired = cell(clean, (row) => row.fired, field);
    const silent = cell(clean, (row) => !row.fired, field);
    outcomes[key] = {
      field: key,
      tutorGated: field !== null && TUTOR_GATED_FIELDS.includes(field),
      warrantAligned: field === WARRANT_ALIGNED_FIELD,
      fired,
      silent,
      // Positive = flagged moments stalled more often than passed-over ones,
      // which is the gate doing its job as a detector.
      discrimination: proportionDifference(silent.advanced, silent.total, fired.advanced, fired.total),
    };
  }
  const firedRows = clean.filter((row) => row.fired).length;
  // Derived, not asserted: an arm is observational when the gate firing produced no
  // injected text anywhere in the data. `injectedOnFired === 0` with `firedRows > 0`
  // is the evidence for that; an arm with no firings at all cannot support the
  // claim either way, so it falls back to the declared list.
  const injectedOnFired = clean.filter((row) => row.fired && row.injected).length;
  const declared = OBSERVATIONAL_ARMS.includes(arm);
  const observational = firedRows > 0 ? injectedOnFired === 0 : declared;
  return {
    arm,
    observational,
    declaredObservational: declared,
    armClassificationMismatch: firedRows > 0 && observational !== declared,
    injectedOnFired,
    decisions: decisions.length,
    clean: clean.length,
    excluded: { deliveryLeaked: decisions.filter((row) => row.deliveryLeaked).length },
    // Covariates, not exclusions. `fireRate` is here because it is the threat to
    // the between-arm contrast: the arms do not flag the same share of their turns,
    // so a treated arm's flagged moments are not drawn from the same pool as the
    // baseline's.
    covariates: {
      draftLeaked: clean.filter((row) => row.draftLeaked).length,
      fallback: clean.filter((row) => row.fallback).length,
      fireRate: wilsonInterval(firedRows, clean.length),
    },
    fired: outcomes.any.fired,
    silent: outcomes.any.silent,
    warrantAligned: WARRANT_ALIGNED_FIELD,
    outcomes,
    suppressed: cell(clean, (row) => row.suppressed, WARRANT_ALIGNED_FIELD),
    byTrigger: {
      warrant_skip: cell(clean, (row) => row.trigger === 'warrant_skip', WARRANT_ALIGNED_FIELD),
      stagnant_repeat: cell(clean, (row) => row.trigger === 'stagnant_repeat', WARRANT_ALIGNED_FIELD),
    },
    discrimination: outcomes[WARRANT_ALIGNED_FIELD].discrimination,
    regressionRate: {
      fired: wilsonInterval(clean.filter((row) => row.fired && row.regressed).length, firedRows),
      silent: wilsonInterval(clean.filter((row) => !row.fired && row.regressed).length, clean.length - firedRows),
    },
  };
}

/**
 * Whether acting on the gate's flagged moments paid off, comparing an injecting
 * arm against the observational arms on flagged moments only.
 *
 * Reported on the warrant-aligned field. Using the disjunction here would read the
 * intervention's own `suppress_new_premise` instruction as a failure to help, since
 * two of the three components cannot rise on a turn where the tutor is forbidden to
 * release a premise.
 *
 * Restricted to `isTreatmentEligible` rows: a deterministic-fallback turn replaced
 * the tutor's candidate with a canned reply, so the intervention did not reach the
 * learner as written and the row cannot speak to whether acting on the flag helped.
 *
 * The baseline is phase-matched. Without that, running two archives together would
 * pool an observational arm from one against an injecting arm from the other, which
 * compares scenario suites and stacks rather than treatments.
 *
 * Two limits hold even so. It is between-arm rather than within-dialogue — the arms
 * ran as separate dialogues, so the flagged moments are not the same moments — and
 * the arms do not flag the same share of their turns (see `fireRate`), so the pools
 * differ in composition as well as in treatment. It answers "does intervening at
 * gate-selected moments raise the advance rate" and not "would this turn have gone
 * better".
 *
 * @param {Map<string, Array<object>>|object} decisionsByArm arm name → decision rows
 */
export function summarizeTreatment(decisionsByArm) {
  const byArm = decisionsByArm instanceof Map ? decisionsByArm : new Map(Object.entries(decisionsByArm || {}));
  const arms = [...byArm.keys()];
  const observationalArms = arms.filter((arm) => isObservationalArm(arm, byArm.get(arm) || []));
  const injectingArms = arms.filter((arm) => !observationalArms.includes(arm));
  if (observationalArms.length === 0 || injectingArms.length === 0) return [];
  const firedCell = (rows) => {
    const eligible = rows.filter((row) => isTreatmentEligible(row) && row.fired);
    const advanced = eligible.filter((row) => advancedOnField(row, WARRANT_ALIGNED_FIELD)).length;
    return { advanced, total: eligible.length, ...wilsonInterval(advanced, eligible.length) };
  };
  return injectingArms.map((arm) => {
    const treatedRows = byArm.get(arm) || [];
    const phases = new Set(treatedRows.map((row) => row.phase ?? null));
    const baselineRows = observationalArms.flatMap((baselineArm) =>
      (byArm.get(baselineArm) || []).filter((row) => phases.has(row.phase ?? null)),
    );
    const treated = firedCell(treatedRows);
    const baseline = firedCell(baselineRows);
    return {
      arm,
      field: WARRANT_ALIGNED_FIELD,
      baselineArms: observationalArms.filter((baselineArm) =>
        (byArm.get(baselineArm) || []).some((row) => phases.has(row.phase ?? null)),
      ),
      phases: [...phases].filter((phase) => phase !== null),
      treated,
      baseline,
      effect: proportionDifference(treated.advanced, treated.total, baseline.advanced, baseline.total),
    };
  });
}

/**
 * Score an alternative gate policy against the same archived moments.
 *
 * The policy is a function of the recorded assignment inputs, so any candidate —
 * a different label set, a threshold, a local model's stored predictions — can be
 * replayed over the archive at zero cost.
 *
 * The hard limit, and the reason this returns `offPolicy: true`: the outcomes are
 * the ones that followed the gate that actually ran. Scoring a policy that would
 * have fired somewhere else assumes the dialogue would have gone the same way,
 * and it would not have. So this measures how well a policy *predicts* stalls in
 * recorded dialogue, which is a real and useful thing to rank policies on, and it
 * does not measure how much advancement a policy would *cause*.
 */
export function scoreAlternativeGate(decisions, policy, field = WARRANT_ALIGNED_FIELD) {
  const clean = decisions.filter(isCleanDecision);
  const rows = clean.map((decision) => ({
    ...decision,
    predicted: Boolean(policy(decision)),
    moved: advancedOnField(decision, field),
  }));
  const firedStalled = rows.filter((row) => row.predicted && !row.moved).length;
  const firedTotal = rows.filter((row) => row.predicted).length;
  const silentAdvanced = rows.filter((row) => !row.predicted && row.moved).length;
  const silentTotal = rows.filter((row) => !row.predicted).length;
  return {
    offPolicy: true,
    field,
    n: rows.length,
    firesOn: firedTotal,
    // Of the moments the policy would flag, the share that did stall — the
    // fraction of interventions that would have been aimed at a real stall.
    stallPrecision: { ...wilsonInterval(firedStalled, firedTotal), advanced: firedStalled, total: firedTotal },
    // Of the moments it would pass over, the share that did advance — the
    // fraction of silences that were correct.
    silenceAccuracy: { ...wilsonInterval(silentAdvanced, silentTotal), advanced: silentAdvanced, total: silentTotal },
    discrimination: proportionDifference(silentAdvanced, silentTotal, firedTotal - firedStalled, firedTotal),
  };
}
