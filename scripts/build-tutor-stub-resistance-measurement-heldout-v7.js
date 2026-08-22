#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v7.json');
const CONSUMED = [
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json',
  'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json',
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json',
  'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v6.json',
].map((relative) => path.join(ROOT, relative));
const FREEZE_COMMIT = '3cee32cdc2a2d786fae7dbda8ee137a5f6a46b87';
const REGISTRATION_COMMIT = '5e1c125907b3ff7adfb2ac2493d3397d8cffdbc7';
const FIELD_NAMES = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

const settings = [
  'canal lock station',
  'observatory mirror room',
  'ceramics glaze library',
  'marsh sampling depot',
  'rail junction cabin',
  'orchard genetics counter',
  'municipal poster workshop',
  'spillway telemetry kiosk',
  'costume conservation bay',
  'public nutrition studio',
  'theater rigging store',
  'materials fatigue court',
  'botanical accession hall',
  'filtration chemistry bench',
  'manuscript repair chamber',
  'pollinator survey office',
  'ocean sensor garage',
  'enamel firing classroom',
  'ferry routing annex',
  'mineral optics laboratory',
  'terrace farming classroom',
  'seamanship chart room',
  'land parcel records room',
  'snowpack telemetry shelter',
];
const objects = ['audit card', 'sample ampoule', 'device ledger', 'mapping marker', 'safety notice'];
const measures = [
  ['height', 'millimeters'],
  ['mass', 'grams'],
  ['compression', 'kilopascals'],
  ['duration', 'seconds'],
  ['count', 'units'],
  ['spacing', 'centimeters'],
  ['frequency', 'hertz'],
  ['throughput', 'percent'],
  ['angle', 'degrees'],
  ['volume', 'milliliters'],
];

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ranked(seed, rows) {
  return [...rows].sort((left, right) => sha(`${seed}\0${left.id}`).localeCompare(sha(`${seed}\0${right.id}`)));
}

function assign(seed, rows, labels) {
  const ordered = ranked(seed, rows);
  if (ordered.length !== labels.length) throw new Error(`assignment ${seed} length mismatch`);
  return new Map(ordered.map((row, index) => [row.id, labels[index]]));
}

function triggerFor(item, index) {
  const variants = [
    `Before touching the ${item}, I contest this exercise's right to dictate the form of my reply, and I am holding my answer back.`,
    `The ${item} prompt assumes a mandate it has not earned; I decline to enter the inquiry on that basis.`,
    `Who gave this ${item} procedure jurisdiction over what counts as my response? Until that is answered, I withhold it.`,
    `I do not recognize the ${item} task's claimed power to bind me to its categories, so its question goes unanswered.`,
    `Participation is off the table while the ${item} protocol presents its framing authority as a settled fact.`,
  ];
  return variants[index % variants.length];
}

function interventionFor({ item, measure, register, actionPresent, index }) {
  const [dimension] = measure;
  if (actionPresent && register === 'warm') {
    const variants = [
      `You do not have to accept the ${item} procedure's authority. If you choose, we can look together only at what its two public ${dimension} entries show.`,
      `We can leave the ${item} mandate disputed. If it feels workable, let us examine together just the paired ${dimension} observations.`,
      `Your jurisdiction objection can stay open. You may choose whether we jointly test only the narrow ${dimension} comparison in the shared record.`,
    ];
    return variants[index % variants.length];
  }
  if (actionPresent && register === 'plain') {
    const variants = [
      `Do not accept the ${item} mandate. Compare only the two ${dimension} entries.`,
      `The ${item} procedure may lack authority. State only what the paired ${dimension} readings show.`,
      `Leave jurisdiction over the ${item} undecided. Check the two ${dimension} values as a separate question.`,
    ];
    return variants[index % variants.length];
  }
  if (actionPresent && register === 'neither') {
    const variants = [
      `The grand ${item} authority can keep its ridiculous paper crown. Checking whether the two ${dimension} readings differ is a separate bounded question, so compare them.`,
      `Let the pompous ${item} mandate sulk in its velvet throne room. It need not be accepted to test the paired ${dimension} observations on their own merits.`,
      `The ${item} charter may parade like a tin emperor, but its jurisdiction is distinct from the narrow evidential question of what the two ${dimension} entries show.`,
    ];
    return variants[index % variants.length];
  }
  if (register === 'warm') {
    const variants = [
      `If you choose, we can slow down and look together at whichever ${item} entry feels easiest to start with.`,
      `We can take this gently. You may choose which part of the ${item} record we consider together first.`,
      `There is no pressure to hurry. If you want, let us begin together with one concrete ${item} detail you select.`,
    ];
    return variants[index % variants.length];
  }
  if (register === 'plain') {
    const variants = [
      `Read one ${item} entry. State one fact from it.`,
      `Use the ${item} record. Give one short answer.`,
      `Select one ${item} line. Report what it says.`,
    ];
    return variants[index % variants.length];
  }
  const variants = [
    `Splendid: the ${item} objection has donned a crystal cape and demanded that the ceiling applaud.`,
    `Naturally the ${item} dispute now requires a golden staircase, nine trumpets, and a ceremonial thunderstorm.`,
    `Behold, the ${item} protest arrives in a jeweled carriage and orders every lamp to bow.`,
  ];
  return variants[index % variants.length];
}

function positiveTurns({ item, measure, left, right, stratum, interveningDependent, index }) {
  const [dimension, unit] = measure;
  const merits = [
    `Reading only the shared ${item} record, ${right} ${unit} is above ${left} ${unit}; the limited ${dimension} test therefore shows a difference.`,
    `For this confined comparison, the ${item}'s second ${dimension} observation exceeds the first by ${right - left} ${unit}.`,
    `The public entries put the ${item} at ${left} and ${right} ${unit}, so the narrow evidential answer is that they are not equal.`,
  ][index % 3];
  const condition = [
    `I will take part on the explicit condition that we consult only the published ${item} ${dimension} readings and infer no submission to the disputed mandate.`,
    `My boundary is precise: use the two shared ${dimension} observations for the ${item}, and do not treat my reply as conceding jurisdiction.`,
    `I can respond within the paired ${item} ${dimension} evidence, so long as that response is not repurposed as agreement with the protocol's authority.`,
  ][index % 3];
  const combined = `${condition} ${merits}`;
  const recoveryText = stratum === 'merits_only' ? merits : stratum === 'grounded_only' ? condition : combined;
  if (interveningDependent) {
    return {
      prior: `I notice the attempt to narrow the ${item} issue, but I have not supplied a finding or a concrete boundary for joining it.`,
      tutor: `From the shared ${item} materials alone, state either the limited ${dimension} finding or the exact condition under which you will engage.`,
      current: recoveryText,
      evidenceSource: 'current_learner',
      meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
      conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
    };
  }
  return {
    prior: recoveryText,
    tutor: `Remain within that confined ${item} ${dimension} issue and say whether the common record supports anything else.`,
    current: `I retain that bounded ${item} reply. This closing sentence adds no wider grant of authority and does not retract it.`,
    evidenceSource: 'prior_post_trigger',
    meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
    conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
  };
}

function negativeTurns({ item, measure, index }) {
  const [dimension] = measure;
  const variants = [
    {
      prior: `I register that you have proposed a smaller ${item} question, but recognition of the proposal is not engagement with it.`,
      current: `I heard the ${item} request. That is the full extent of my response: no ${dimension} finding and no usable participation term.`,
    },
    {
      prior: `Every version of the ${item} inquiry remains refused, whether broad, narrow, or renamed.`,
      current: `My refusal of the ${item} inquiry is categorical; I offer neither analysis of its record nor any condition that would permit participation.`,
    },
    {
      prior: `I suspect hidden motives behind whoever assembled the ${item} materials.`,
      current: `Suspicion about the ${item} is all I am asserting. I point to no public flaw, answer no bounded question, and set no operational boundary.`,
    },
    {
      prior: `The ventilation system is more worthy of discussion than this ${item} exercise.`,
      current: `I am changing the subject to the room and leaving both ${item} ${dimension} observations unexamined.`,
    },
    {
      prior: `Maybe an unspecified future arrangement would make a ${item} inquiry acceptable, but I cannot name it.`,
      current: `There is no current condition to apply and no result from the shared ${item} entries in what I have said.`,
    },
  ];
  const selected = variants[index % variants.length];
  return {
    prior: selected.prior,
    tutor: `Provide either the confined ${item} ${dimension} finding or a concrete publicly checkable term for engagement.`,
    current: selected.current,
  };
}

function evidenceFor({ row, turns, stratum, actionPresent, register }) {
  const primary = [];
  if (stratum === 'merits_only' || stratum === 'both') {
    primary.push({
      field: 'bounded_test_merits_engagement',
      source_id: turns.evidenceSource,
      text: turns.meritsText,
    });
  }
  if (stratum === 'grounded_only' || stratum === 'both') {
    primary.push({
      field: 'grounded_precise_jurisdictional_condition',
      source_id: turns.evidenceSource,
      text: turns.conditionText,
    });
  }
  const fidelity = [];
  if (actionPresent) {
    fidelity.push({ field: 'delivered_clarify_distinction', source_id: 'intervention', text: row.intervention });
  }
  if (register === 'warm' || register === 'plain') {
    fidelity.push({ field: 'delivered_register', source_id: 'intervention', text: row.intervention });
  }
  return { primary, fidelity };
}

function stringsIn(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

function exactReusedTextIssues(cases, consumedCases) {
  const consumedTexts = new Set(consumedCases.flatMap(stringsIn));
  return cases.flatMap((row) => [
    ...FIELD_NAMES.flatMap((field) =>
      consumedTexts.has(row[field]) ? [`${row.case_id}:${field}:exact_consumed_text_reuse`] : [],
    ),
    ...[...row.expected.primary_evidence, ...row.expected.fidelity_evidence].flatMap((entry) =>
      consumedTexts.has(entry.text) ? [`${row.case_id}:${entry.field}:exact_consumed_evidence_reuse`] : [],
    ),
  ]);
}

function validate(cases, consumedCases) {
  const issues = [];
  if (cases.length !== 120) issues.push(`expected 120 cases; found ${cases.length}`);
  if (new Set(cases.map((row) => row.case_id)).size !== cases.length) issues.push('case ids are not unique');
  const recoveryCounts = {};
  const registerCounts = {};
  let actionPresent = 0;
  let interveningDependent = 0;
  for (const row of cases) {
    recoveryCounts[row.strata.recovery] = (recoveryCounts[row.strata.recovery] || 0) + 1;
    registerCounts[row.expected.fidelity.delivered_register] =
      (registerCounts[row.expected.fidelity.delivered_register] || 0) + 1;
    actionPresent += Number(row.expected.fidelity.delivered_clarify_distinction === 'yes');
    interveningDependent += Number(row.strata.intervening_tutor_dependent);
    for (const quote of [...row.expected.primary_evidence, ...row.expected.fidelity_evidence]) {
      const source = row[quote.source_id];
      if (!source || source.indexOf(quote.text) < 0 || source.indexOf(quote.text) !== source.lastIndexOf(quote.text)) {
        issues.push(`${row.case_id}:${quote.field}:quote_not_unique_exact`);
      }
    }
  }
  const expectedRecovery = { merits_only: 32, grounded_only: 32, both: 16, no_recovery: 40 };
  const expectedRegister = { warm: 40, plain: 40, neither: 40 };
  if (Object.entries(expectedRecovery).some(([label, count]) => recoveryCounts[label] !== count)) {
    issues.push('recovery strata drifted');
  }
  if (Object.entries(expectedRegister).some(([label, count]) => registerCounts[label] !== count)) {
    issues.push('register strata drifted');
  }
  if (actionPresent !== 80) issues.push(`expected 80 action-present cases; found ${actionPresent}`);
  if (interveningDependent !== 24)
    issues.push(`expected 24 intervening-dependent cases; found ${interveningDependent}`);
  issues.push(...exactReusedTextIssues(cases, consumedCases));
  return issues;
}

const base = settings.flatMap((setting) =>
  objects.map((object, objectIndex) => ({
    id: `v7-${String(settings.indexOf(setting) * objects.length + objectIndex + 1).padStart(3, '0')}`,
    item: `${setting} ${object}`,
  })),
);
const recoveryLabels = [
  ...Array(32).fill('merits_only'),
  ...Array(32).fill('grounded_only'),
  ...Array(16).fill('both'),
  ...Array(40).fill('no_recovery'),
];
const registerLabels = [...Array(40).fill('warm'), ...Array(40).fill('plain'), ...Array(40).fill('neither')];
const actionLabels = [...Array(80).fill(true), ...Array(40).fill(false)];
const recoveryById = assign('v7-recovery-strata-20260822', base, recoveryLabels);
const registerById = assign('v7-register-strata-20260822', base, registerLabels);
const actionById = assign('v7-action-strata-20260822', base, actionLabels);
const positiveRows = base.filter((row) => recoveryById.get(row.id) !== 'no_recovery');
const dependentIds = new Set(
  ranked('v7-intervening-dependence-20260822', positiveRows)
    .slice(0, 24)
    .map((row) => row.id),
);

const cases = base.map((baseRow, index) => {
  const measure = measures[index % measures.length];
  const left = 11 + ((index * 7) % 83);
  const right = left + 2 + (index % 6);
  const stratum = recoveryById.get(baseRow.id);
  const register = registerById.get(baseRow.id);
  const actionPresent = actionById.get(baseRow.id);
  const row = {
    case_id: baseRow.id,
    trigger: triggerFor(baseRow.item, index),
    intervention: interventionFor({
      item: baseRow.item,
      measure,
      register,
      actionPresent,
      index,
    }),
  };
  const turns =
    stratum === 'no_recovery'
      ? negativeTurns({ item: baseRow.item, measure, index })
      : positiveTurns({
          item: baseRow.item,
          measure,
          left,
          right,
          stratum,
          interveningDependent: dependentIds.has(baseRow.id),
          index,
        });
  Object.assign(row, {
    prior_post_trigger: turns.prior,
    intervening_tutor: turns.tutor,
    current_learner: turns.current,
  });
  const evidence = evidenceFor({ row, turns, stratum, actionPresent, register });
  return {
    ...row,
    strata: {
      recovery: stratum,
      register,
      action_present: actionPresent,
      intervening_tutor_dependent: dependentIds.has(baseRow.id),
      boundary_negative:
        stratum === 'no_recovery'
          ? ['generic_assent', 'blanket_refusal', 'ungrounded_suspicion', 'off_topic', 'unspecified_future_condition'][
              index % 5
            ]
          : null,
    },
    expected: {
      primary: {
        bounded_test_merits_engagement: ['merits_only', 'both'].includes(stratum) ? 'yes' : 'no',
        grounded_precise_jurisdictional_condition: ['grounded_only', 'both'].includes(stratum) ? 'yes' : 'no',
        final_recovery: stratum === 'no_recovery' ? 'no' : 'yes',
      },
      primary_evidence: evidence.primary,
      fidelity: {
        delivered_clarify_distinction: actionPresent ? 'yes' : 'no',
        delivered_register: register,
      },
      fidelity_evidence: evidence.fidelity,
    },
  };
});

const consumedCases = CONSUMED.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')).cases);
const issues = validate(cases, consumedCases);
if (issues.length) throw new Error(issues.join('; '));
if (fs.existsSync(OUTPUT)) throw new Error(`${path.relative(ROOT, OUTPUT)} already exists`);
const corpus = {
  schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v7',
  version: 7,
  role: 'genuinely_fresh_heldout_blinded',
  frozen: true,
  authored_after_instrument_freeze_commit: FREEZE_COMMIT,
  authored_after_registration_commit: REGISTRATION_COMMIT,
  authoring_method: 'deterministic_coordinator_authored_stance_aligned_stratified_paraphrase_generator_v3',
  judge_models_authored_gold_or_cases: false,
  prompt_examples_allowed: false,
  zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3_v5_v6: true,
  cases,
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(corpus, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(
  `${JSON.stringify({ status: 'created', path: path.relative(ROOT, OUTPUT), cases: cases.length, sha256: sha(fs.readFileSync(OUTPUT)) })}\n`,
);
