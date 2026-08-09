import { createHash } from 'node:crypto';
import { STANCE_GATE_VERSION } from './registerStanceFidelity.js';
import { MANNER_PRESENCE_PROMPT_VERSION } from './registerMannerPresence.js';
import { fisherExactTwoSided } from './fisherExact.js';

// Frozen two-arm plan for the mock-compliment probe
// (notes/2026-08-09-register-mock-praise-preregistration.md).
//
// Where it comes from. On the strong-stack re-run of the plain sarcastic arm
// (eval-2026-08-08-6021754f, paper v3.0.281) the writer used a handed cue in
// all fifteen turns and a reader called eleven of them edged. Reading the four
// flat ones afterwards, what separated them was a mock-compliment: praise in
// the words the sentence then takes back. Ten of eleven edged turns carried
// one, one of four flat turns did. The plain register never asks for it — it
// asks for any cue from a six-entry family, two of which grant no praise at
// all, and all four flat turns complied with one of those two and then taught
// straight.
//
// So this run asks for the device outright and measures whether the reading
// moves. Both arms run in one batch on one stack, because the alternative —
// comparing a new arm against the stored fifteen — adds a run boundary to a
// contrast that is already small.
export const REGISTER_MOCK_PRAISE_PROBE = Object.freeze({
  schema: 'machinespirits.register-mock-praise-probe-plan.v1',
  preregistration: 'notes/2026-08-09-register-mock-praise-preregistration.md',
  scenarioSource: 'config/charisma-recognition-desire-scenarios.yaml',
  // The two arms, named by role rather than by cell, because every measure
  // below is a contrast between them and a report that has to remember which
  // cell number is the treatment is a report that will one day get it wrong.
  arms: Object.freeze({
    control: Object.freeze({
      profile: 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
      register: 'sarcastic',
      asksForMockPraise: false,
    }),
    treatment: Object.freeze({
      profile: 'cell_203_id_director_sarcastic_mock_praise_challenge_breakthrough_dynamic_verified',
      register: 'sarcastic_mock_praise',
      asksForMockPraise: true,
    }),
  }),
  scenarios: Object.freeze([
    'charisma_desire_resistance_breakthrough_boredom',
    'charisma_desire_resistance_breakthrough_frustration',
    'charisma_desire_resistance_breakthrough_irrelevance',
    'charisma_desire_resistance_breakthrough_question_flood',
    'charisma_desire_resistance_breakthrough_rote_parroting',
  ]),
  repeats: 3,
  generation: Object.freeze({
    tutorModel: 'codex.gpt-5.5',
    learnerModel: 'codex.gpt-5.5',
    parallelism: 1,
    skipRubric: true,
  }),
  scoring: Object.freeze({
    tutorRubricVersion: '2.2',
    tutorJudgeCli: 'claude',
    tutorJudgeModel: 'claude-sonnet-5',
    tutorJudgeLabel: 'claude-code/claude-sonnet-5',
    registerJudge: 'claude-code.sonnet-5',
  }),
  measurement: Object.freeze({
    gateVersion: STANCE_GATE_VERSION,
    fold: 'adopting_turn',
    foldSource: 'scripts/report-charisma-desire-breakthrough-matrix.js',
    presenceQuestion: MANNER_PRESENCE_PROMPT_VERSION,
    presenceReader: 'claude-code/claude-sonnet-5',
  }),
  tutorSeats: Object.freeze(['id', 'ego', 'agency_return_verifier']),
  // The stored strong-stack sarcastic arm, quoted here so the run has a second
  // baseline that predates it. Not the primary: it is a different batch.
  //
  // The device counts are the post-hoc pattern this run exists to test,
  // recomputed under the pinned token list below rather than under the ad-hoc
  // regex that first found it, so the prospective test and its prior are
  // measured with one instrument. Both give the same table.
  storedControl: Object.freeze({
    runId: 'eval-2026-08-08-6021754f',
    profile: 'cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified',
    rows: 15,
    readAsEdged: 11,
    mockPraisePresent: 11,
    mockPraiseEdged: 10,
    mockPraiseFlat: 1,
    plainEdged: 1,
    plainFlat: 3,
    devicePosthocP: 0.033,
    paperVersion: '3.0.281',
  }),
  // What thirty rows can and cannot see, computed before the run rather than
  // discovered after it. Fifteen against fifteen starting from 11/15 has four
  // rows of headroom, and Fisher cannot reach 0.05 inside it — a perfect 15/15
  // against 11/15 is p = 0.0996. So the primary is registered as a screen whose
  // most likely honest answer is NO_SEPARATION_AT_THIS_SIZE, and the run's
  // value does not rest on it: the manipulation check and the device test below
  // are answerable at this size and the primary is not.
  detectability: Object.freeze({
    note: 'two-sided Fisher, treatment vs a 15-row control at the observed 11/15 rate',
    separatingOutcomes: Object.freeze(['15/15 vs 11/15 -> p = 0.0996 (does not separate)']),
    smallestSeparatingTreatment: null,
  }),
});

// The mock-praise detector, pinned here and hashed into the plan.
//
// It looks for a word that grants merit. It cannot see whether the sentence
// takes the merit back, and it is not trying to: that is the manner, and the
// reader answers it. Keeping the two apart is the same discipline that split
// cue compliance from manner presence in the stance gate — a list can find a
// word, and only a reader can find a meaning.
//
// The list is the eight tokens used in the post-hoc read of the stored fifteen
// plus the five adjectives the treatment contract itself offers the writer
// ("clever, tidy, efficient" and their neighbours). Both arms are measured with
// this one list, and the stored control's count is restated under it below, so
// no comparison here is made with two different instruments.
export const MOCK_PRAISE_TOKENS = Object.freeze([
  'wonderful',
  'conveniently',
  'apparently',
  'nice trick',
  'impressive',
  'marvellous',
  'marvelous',
  'of course',
  'naturally',
  'clever',
  'tidy',
  'efficient',
  'elegant',
  'admirable',
]);

const MOCK_PRAISE_PATTERN = new RegExp(
  `\\b(?:${MOCK_PRAISE_TOKENS.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'giu',
);

/** Every mock-praise token in the turn, lowercased, in order of appearance. */
export function findMockPraiseTokens(text) {
  const normalized = String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
  return [...normalized.matchAll(MOCK_PRAISE_PATTERN)].map((match) => match[0].toLowerCase());
}

/** True when the turn grants merit in words somewhere. Says nothing about whether it takes them back. */
export function hasMockPraise(text) {
  return findMockPraiseTokens(text).length > 0;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function hashRegisterMockPraiseProbe(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

export function armProfiles(grid = REGISTER_MOCK_PRAISE_PROBE) {
  return [grid.arms.control.profile, grid.arms.treatment.profile];
}

/** Which arm a row belongs to, or null when the row is not in this design. */
export function armOf(profileName, grid = REGISTER_MOCK_PRAISE_PROBE) {
  for (const [name, arm] of Object.entries(grid.arms)) {
    if (arm.profile === profileName) return name;
  }
  return null;
}

export function buildRegisterMockPraiseProbePlan() {
  const grid = REGISTER_MOCK_PRAISE_PROBE;
  const jobs = [];
  for (const [armName, arm] of Object.entries(grid.arms)) {
    for (const scenario of grid.scenarios) {
      for (let repeat = 1; repeat <= grid.repeats; repeat += 1) {
        jobs.push({ ordinal: jobs.length + 1, arm: armName, profile: arm.profile, scenario, repeat });
      }
    }
  }
  const plan = {
    ...grid,
    arms: JSON.parse(JSON.stringify(grid.arms)),
    scenarios: [...grid.scenarios],
    tutorSeats: [...grid.tutorSeats],
    generation: { ...grid.generation },
    scoring: { ...grid.scoring },
    measurement: { ...grid.measurement },
    storedControl: { ...grid.storedControl },
    detectability: { ...grid.detectability, separatingOutcomes: [...grid.detectability.separatingOutcomes] },
    mockPraiseTokens: [...MOCK_PRAISE_TOKENS],
    design: '2 arms x 5 controlled resistance targets x 3 repeats, one batch, one stack',
    estimands: [
      'tutor_stack_provenance',
      'mock_praise_delivery',
      'manner_presence',
      'tutor_v22_cost',
      'mock_praise_predicts_edge',
    ],
    plannedRows: jobs.length,
    jobs,
  };
  return { ...plan, planSha256: hashRegisterMockPraiseProbe(plan) };
}

export function validateRegisterMockPraiseProbePlan(plan) {
  const errors = [];
  const grid = REGISTER_MOCK_PRAISE_PROBE;
  const expectedRows = Object.keys(grid.arms).length * grid.scenarios.length * grid.repeats;
  if (plan.plannedRows !== expectedRows || plan.jobs?.length !== expectedRows) {
    errors.push(`expected ${expectedRows} planned rows, found ${plan.jobs?.length || 0}`);
  }
  const counts = new Map();
  for (const job of plan.jobs || []) {
    counts.set(`${job.arm}::${job.scenario}`, (counts.get(`${job.arm}::${job.scenario}`) || 0) + 1);
  }
  for (const armName of Object.keys(grid.arms)) {
    for (const scenario of grid.scenarios) {
      const key = `${armName}::${scenario}`;
      if (counts.get(key) !== grid.repeats) {
        errors.push(`${key} expected ${grid.repeats} rows, found ${counts.get(key) || 0}`);
      }
    }
  }
  // Both arms must be the same size. An unbalanced design would let the
  // treatment buy its way past the control on rows rather than on manner.
  if (grid.arms.control.profile === grid.arms.treatment.profile) {
    errors.push('control and treatment name the same profile');
  }
  if (grid.arms.control.register === grid.arms.treatment.register) {
    errors.push('control and treatment name the same register');
  }
  if (grid.arms.treatment.asksForMockPraise !== true || grid.arms.control.asksForMockPraise !== false) {
    errors.push('the treatment arm must be the one that asks for mock praise, and the control the one that does not');
  }
  if (/nemotron|kimi/iu.test(grid.generation.tutorModel)) {
    errors.push(`tutor model ${grid.generation.tutorModel} is the weak pairing this arc exists to replace`);
  }
  const { rows, readAsEdged, mockPraisePresent } = grid.storedControl;
  for (const [label, value] of [
    ['readAsEdged', readAsEdged],
    ['mockPraisePresent', mockPraisePresent],
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > rows) {
      errors.push(`storedControl ${label} must be an integer within 0..${rows}, found ${value}`);
    }
  }
  // The detectability note is the thing most likely to be quietly dropped, and
  // dropping it is what turns "we could not see it" into "it is not there".
  if (!grid.detectability.separatingOutcomes.length) {
    errors.push('the plan must state which outcomes could separate at this size');
  }
  return { ok: errors.length === 0, errors, expectedRows, observedCells: counts.size };
}

/**
 * Did the tutor seats call the model the plan names?
 *
 * Read off `dialogueTrace`, which records the call, not off the run's model
 * columns, which record the ask. Those two disagreed silently across four
 * August runs, which is why this is a registered measure and not a courtesy.
 */
export function checkTutorStackProvenance(dialogues, { grid = REGISTER_MOCK_PRAISE_PROBE } = {}) {
  const dot = grid.generation.tutorModel.indexOf('.');
  const expected = {
    provider: grid.generation.tutorModel.slice(0, dot),
    model: grid.generation.tutorModel.slice(dot + 1),
  };
  const seats = new Set(grid.tutorSeats);
  const errors = [];
  const observed = new Map();
  let seatCalls = 0;

  for (const dialogue of dialogues || []) {
    const label = dialogue.dialogueId || '(unnamed dialogue)';
    for (const entry of dialogue.trace || []) {
      if (!seats.has(entry?.agent)) continue;
      const provider = entry.metrics?.provider ?? entry.provider ?? null;
      const model = entry.metrics?.model ?? entry.model ?? null;
      if (!provider || !model) {
        errors.push(`${label}: ${entry.agent}/${entry.action} records no provider or model`);
        continue;
      }
      seatCalls += 1;
      const pair = `${provider}/${model}`;
      observed.set(pair, (observed.get(pair) || 0) + 1);
      if (provider !== expected.provider || model !== expected.model) {
        errors.push(`${label}: ${entry.agent}/${entry.action} called ${pair}, plan says ${grid.generation.tutorModel}`);
      }
    }
  }

  if (!seatCalls && !errors.length) errors.push('no tutor seat calls found in any dialogue trace');
  return {
    ok: errors.length === 0,
    expected: grid.generation.tutorModel,
    seatCalls,
    observed: Object.fromEntries([...observed.entries()].sort()),
    errors,
  };
}

function emptyBucket() {
  return {
    rows: 0,
    cueCompliant: 0,
    mockPraisePresent: 0,
    readAsEdged: 0,
    presenceUnread: 0,
    positiveOutcomes: 0,
    tutorV22Sum: 0,
    tutorV22Count: 0,
    registerSum: 0,
    registerCount: 0,
    gateIdentities: new Set(),
    // The device test's 2x2, accumulated per arm and pooled by the caller.
    mockPraiseEdged: 0,
    mockPraiseFlat: 0,
    plainEdged: 0,
    plainFlat: 0,
  };
}

function finishBucket(bucket) {
  const { gateIdentities, ...rest } = bucket;
  return {
    ...rest,
    gateIdentities: [...gateIdentities].sort(),
    tutorV22Mean: bucket.tutorV22Count ? bucket.tutorV22Sum / bucket.tutorV22Count : null,
    registerRubricMean: bucket.registerCount ? bucket.registerSum / bucket.registerCount : null,
  };
}

function contrast(label, treatment, treatmentN, control, controlN, { controlLabel = 'control' } = {}) {
  return {
    label,
    treatment: `${treatment}/${treatmentN}`,
    [controlLabel]: `${control}/${controlN}`,
    p: fisherExactTwoSided(treatment, treatmentN - treatment, control, controlN - control),
  };
}

/**
 * Fail-closed two-arm summary over the matrix reporter's analysis rows.
 *
 * Refuses to report if a row is missing its manner reading, if either arm was
 * scored under an unexpected gate, if the judges differ from the plan's, or if
 * the tutor seats did not call the stack the plan names. A half-measured run
 * that reads as a clean null is the failure this shape exists to prevent.
 */
export function summarizeRegisterMockPraiseProbe(analyses, { provenance = null } = {}) {
  const grid = REGISTER_MOCK_PRAISE_PROBE;
  const profiles = new Set(armProfiles(grid));
  const rows = analyses.filter((row) => profiles.has(row.profileName) && grid.scenarios.includes(row.scenarioId));
  const errors = [];
  const buckets = { control: emptyBucket(), treatment: emptyBucket() };

  for (const row of rows) {
    const armName = armOf(row.profileName, grid);
    const bucket = buckets[armName];
    const stance = row.stanceFidelity || null;

    if (!stance?.applies) {
      errors.push(`${row.rowId}: missing stance-fidelity classification`);
      continue;
    }
    bucket.gateIdentities.add(`${stance.gateRegister}@${stance.gateVersion}`);
    bucket.rows += 1;

    const presence = stance.mannerPresence?.status;
    const read = presence === 'present' || presence === 'absent';
    // An unread row is not a flat row.
    if (!read) {
      errors.push(`${row.rowId}: manner presence unread (${presence || 'missing'})`);
      bucket.presenceUnread += 1;
    }
    if (typeof row.positiveOutcome !== 'boolean') errors.push(`${row.rowId}: no positive-local-outcome verdict`);
    if (row.positiveOutcome === true) bucket.positiveOutcomes += 1;

    if (stance.passed) {
      bucket.cueCompliant += 1;
      if (stance.missingRequired?.length) {
        errors.push(`${row.rowId}: faithful verdict lists missing required parts ${stance.missingRequired.join(', ')}`);
      }
    }

    // Measured off the turn text with one list for both arms, never off the
    // gate, whose cue family differs by arm on purpose.
    const praised = hasMockPraise(row.tutorMessage);
    if (praised) bucket.mockPraisePresent += 1;
    if (read) {
      const edged = presence === 'present';
      if (edged) bucket.readAsEdged += 1;
      if (praised && edged) bucket.mockPraiseEdged += 1;
      if (praised && !edged) bucket.mockPraiseFlat += 1;
      if (!praised && edged) bucket.plainEdged += 1;
      if (!praised && !edged) bucket.plainFlat += 1;
    }

    if (Number.isFinite(row.tutorV22Score)) {
      bucket.tutorV22Sum += row.tutorV22Score;
      bucket.tutorV22Count += 1;
    }
    if (Number.isFinite(row.registerRubricScore)) {
      bucket.registerSum += row.registerRubricScore;
      bucket.registerCount += 1;
    }
  }

  const perArm = grid.scenarios.length * grid.repeats;
  for (const [armName, bucket] of Object.entries(buckets)) {
    if (bucket.rows !== perArm) errors.push(`${armName} arm: expected ${perArm} rows, found ${bucket.rows}`);
    const expectedGate = `${grid.arms[armName].register}@${grid.measurement.gateVersion}`;
    if (bucket.gateIdentities.size > 1) {
      errors.push(`${armName} arm carries more than one gate: ${[...bucket.gateIdentities].sort().join(', ')}`);
    } else if (bucket.gateIdentities.size === 1 && !bucket.gateIdentities.has(expectedGate)) {
      errors.push(`${armName} arm scored under ${[...bucket.gateIdentities][0]}, plan registers ${expectedGate}`);
    }
  }
  if (rows.some((row) => row.tutorV22Score == null)) errors.push('one or more rows are missing tutor-only v2.2 scores');
  if (rows.some((row) => String(row.tutorRubricVersion) !== grid.scoring.tutorRubricVersion)) {
    errors.push(`rows carry a tutor rubric version other than ${grid.scoring.tutorRubricVersion}`);
  }
  if (rows.some((row) => row.tutorJudgeModel !== grid.scoring.tutorJudgeLabel)) {
    errors.push(`rows carry a tutor judge other than ${grid.scoring.tutorJudgeLabel}`);
  }
  if (rows.some((row) => row.registerRubricScore == null)) errors.push('one or more rows are missing register scores');
  if (rows.some((row) => row.registerJudgeModel !== grid.scoring.registerJudge)) {
    errors.push(`rows carry a register judge other than ${grid.scoring.registerJudge}`);
  }
  if (!rows.some((row) => String(row.tutorMessage || '').trim()))
    errors.push('no row carries an adopting turn to read');
  if (!provenance) errors.push('no tutor-stack provenance check supplied');
  else if (!provenance.ok) for (const error of provenance.errors) errors.push(`provenance: ${error}`);

  const status = errors.length ? 'INCOMPLETE' : 'COMPLETE';
  const control = buckets.control;
  const treatment = buckets.treatment;
  const contrasts =
    status === 'COMPLETE'
      ? {
          // The manipulation check. A null primary means nothing until this
          // one says the ask changed what the writer wrote.
          mockPraiseDelivery: contrast(
            'turns granting praise in words',
            treatment.mockPraisePresent,
            treatment.rows,
            control.mockPraisePresent,
            control.rows,
          ),
          // The primary.
          mannerPresence: contrast(
            'read as edged',
            treatment.readAsEdged,
            treatment.rows,
            control.readAsEdged,
            control.rows,
          ),
          // The same question against the batch that raised it.
          mannerPresenceVsStored: contrast(
            'read as edged, against the stored strong-stack arm',
            treatment.readAsEdged,
            treatment.rows,
            grid.storedControl.readAsEdged,
            grid.storedControl.rows,
            { controlLabel: 'stored' },
          ),
          // The post-hoc device, tested prospectively across both arms.
          mockPraisePredictsEdge: {
            label: 'praise in words -> read as edged, pooled over both arms',
            withPraise: `${treatment.mockPraiseEdged + control.mockPraiseEdged}/${
              treatment.mockPraiseEdged + control.mockPraiseEdged + treatment.mockPraiseFlat + control.mockPraiseFlat
            }`,
            withoutPraise: `${treatment.plainEdged + control.plainEdged}/${
              treatment.plainEdged + control.plainEdged + treatment.plainFlat + control.plainFlat
            }`,
            p: fisherExactTwoSided(
              treatment.mockPraiseEdged + control.mockPraiseEdged,
              treatment.mockPraiseFlat + control.mockPraiseFlat,
              treatment.plainEdged + control.plainEdged,
              treatment.plainFlat + control.plainFlat,
            ),
          },
        }
      : null;

  const tutorCost =
    status === 'COMPLETE' && treatment.tutorV22Count && control.tutorV22Count
      ? {
          label: 'tutor v2.2 mean',
          treatment: treatment.tutorV22Sum / treatment.tutorV22Count,
          control: control.tutorV22Sum / control.tutorV22Count,
          delta: treatment.tutorV22Sum / treatment.tutorV22Count - control.tutorV22Sum / control.tutorV22Count,
        }
      : null;

  return {
    schema: 'machinespirits.register-mock-praise-probe-report.v1',
    status,
    expectedRows: perArm * 2,
    observedRows: rows.length,
    measurement: { ...grid.measurement },
    storedControl: { ...grid.storedControl },
    detectability: { ...grid.detectability },
    mockPraiseTokens: [...MOCK_PRAISE_TOKENS],
    provenance,
    arms: { control: finishBucket(control), treatment: finishBucket(treatment) },
    contrasts,
    tutorCost,
    manipulationHeld: status === 'COMPLETE' ? treatment.mockPraisePresent > control.mockPraisePresent : null,
    verdict: status === 'COMPLETE' ? verdictFor(treatment, control, contrasts) : null,
    errors,
  };
}

// Three-valued and keyed to the primary, so a count that merely matches cannot
// be written up as agreement and a count that merely rises cannot be written up
// as an effect. The plan says before the run that at this size the middle
// answer is the likely one.
function verdictFor(treatment, control, contrasts) {
  const p = contrasts?.mannerPresence?.p;
  if (p != null && p < 0.05) {
    return treatment.readAsEdged > control.readAsEdged ? 'MOCK_PRAISE_RAISES_MANNER' : 'MOCK_PRAISE_LOWERS_MANNER';
  }
  return 'NO_SEPARATION_AT_THIS_SIZE';
}

export default {
  REGISTER_MOCK_PRAISE_PROBE,
  MOCK_PRAISE_TOKENS,
  armOf,
  armProfiles,
  buildRegisterMockPraiseProbePlan,
  checkTutorStackProvenance,
  findMockPraiseTokens,
  hasMockPraise,
  hashRegisterMockPraiseProbe,
  summarizeRegisterMockPraiseProbe,
  validateRegisterMockPraiseProbePlan,
};
