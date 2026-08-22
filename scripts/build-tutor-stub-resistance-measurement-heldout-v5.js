#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json');
const CONSUMED = path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json');
const FREEZE_COMMIT = '6d07cc33b75182f9229a01d81f27a26ad3fa7f67';
const FIELD_NAMES = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

const settings = [
  'canal depot',
  'observatory annex',
  'market arcade',
  'coastal archive',
  'railway museum',
  'forest station',
  'municipal workshop',
  'harbor office',
  'textile conservatory',
  'hilltop clinic',
  'theatre storeroom',
  'university foundry',
  'botanical library',
  'river laboratory',
  'courthouse basement',
  'orchard cooperative',
  'lighthouse service room',
  'ceramics institute',
  'ferry terminal',
  'astronomy classroom',
  'public greenhouse',
  'maritime school',
  'city map room',
  'mountain rescue post',
];
const objects = ['inspection tag', 'sample tray', 'calibration card', 'ledger insert', 'display marker'];
const measures = [
  ['length', 'millimeters'],
  ['mass', 'grams'],
  ['temperature', 'degrees'],
  ['duration', 'seconds'],
  ['count', 'units'],
  ['spacing', 'centimeters'],
  ['frequency', 'hertz'],
  ['reflectance', 'percent'],
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
    `I reject the ${item} exercise's claim to set the terms of my participation, so I will not answer it as framed.`,
    `The proposed ${item} inquiry has not established any authority over my response; I am withholding participation.`,
    `I dispute the jurisdiction assumed by this ${item} question and decline its governing premise.`,
    `Nothing about the ${item} request entitles it to command an answer from me in those terms.`,
    `I will not participate while the ${item} check treats its own frame as already binding.`,
  ];
  return variants[index % variants.length];
}

function interventionFor({ item, measure, register, actionPresent, index }) {
  const [dimension] = measure;
  if (actionPresent && register === 'warm') {
    const variants = [
      `I hear why the frame around the ${item} matters to you. We can leave that larger premise unsettled and examine only the two posted ${dimension} entries.`,
      `Your objection to the ${item} frame is worth taking seriously. Accepting the frame is not required; the immediate question is only what the two public ${dimension} entries show.`,
      `Thank you for naming the boundary you see in the ${item} request. Let us hold the authority question open while checking just the paired ${dimension} values.`,
    ];
    return variants[index % variants.length];
  }
  if (actionPresent && register === 'plain') {
    const variants = [
      `Set the broader ${item} premise aside. Compare only the two posted ${dimension} entries; doing so does not accept the larger frame.`,
      `Do not assume the ${item} frame. The bounded task is to state what follows from the two public ${dimension} values.`,
      `Separate accepting the ${item} authority claim from inspecting its evidence. Address only the paired ${dimension} entries.`,
    ];
    return variants[index % variants.length];
  }
  if (actionPresent && register === 'neither') {
    const variants = [
      `Let the grand ${item} charter sleep beneath its velvet seal; summon only the two ${dimension} entries to this tiny court of comparison.`,
      `The ${item} empire may keep its crown in the cupboard. Our little lantern need illuminate only the paired ${dimension} values.`,
      `Leave the ${item} throne unoccupied and invite just two humble ${dimension} entries onto the stage for inspection.`,
    ];
    return variants[index % variants.length];
  }
  if (register === 'warm') {
    const variants = [
      `I appreciate your candor about the ${item}, and I want this exchange to remain respectful as we continue.`,
      `Your concern about the ${item} deserves care, and I am glad you stated it so directly.`,
      `I hear the frustration in your ${item} objection and want to proceed with patience and respect.`,
    ];
    return variants[index % variants.length];
  }
  if (register === 'plain') {
    const variants = [
      `State your position on the ${item} using the posted record.`,
      `Review the ${item} material and give a direct response.`,
      `Continue with the ${item} question and identify your conclusion.`,
    ];
    return variants[index % variants.length];
  }
  const variants = [
    `Behold: the ${item} dispute has earned another brass medal for its already crowded ceremonial sash.`,
    `Surely the ${item} controversy now requires trumpets, banners, and a moonlit procession through the square.`,
    `The ${item} objection rises again, wearing a paper crown and demanding that the furniture applaud.`,
  ];
  return variants[index % variants.length];
}

function positiveTurns({ item, measure, left, right, stratum, interveningDependent, index }) {
  const [dimension, unit] = measure;
  const merits = [
    `The posted ${item} values are ${left} and ${right} ${unit}; the second is larger, so the bounded ${dimension} comparison is unequal.`,
    `On that narrow record, ${right} ${unit} exceeds ${left} ${unit}, which resolves the ${item} ${dimension} comparison.`,
    `The two public ${dimension} entries for the ${item} differ by ${right - left} ${unit}; that is the result of the limited check.`,
  ][index % 3];
  const condition = [
    `I will participate only in comparing the two posted ${item} ${dimension} values, provided that this is not treated as accepting the broader authority claim.`,
    `My condition is that we use only the public ${dimension} entries for the ${item} and draw no conclusion about the disputed frame beyond them.`,
    `I can answer if the inquiry remains confined to the paired ${item} ${dimension} record and does not convert that answer into consent to the larger premise.`,
  ][index % 3];
  const combined = `${condition} ${merits}`;
  const recoveryText = stratum === 'merits_only' ? merits : stratum === 'grounded_only' ? condition : combined;
  if (interveningDependent) {
    return {
      prior: `I understand that a narrower ${item} question has been proposed, but I have not yet stated either a result or a participation condition.`,
      tutor: `Using only the public ${item} record, what ${dimension} result or precise participation boundary can you state?`,
      current: recoveryText,
      evidenceSource: 'current_learner',
      meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
      conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
    };
  }
  return {
    prior: recoveryText,
    tutor: `Keep to that bounded ${item} ${dimension} point and state whether anything further follows from the posted entries.`,
    current: `That remains my complete response to the limited ${item} question; I add no broader concession.`,
    evidenceSource: 'prior_post_trigger',
    meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
    conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
  };
}

function negativeTurns({ item, measure, index }) {
  const [dimension] = measure;
  const variants = [
    {
      prior: `I acknowledge that you mentioned a narrower ${item} question, but acknowledgment is all I offer.`,
      current: `Yes, I have heard the ${item} request; I still provide neither a ${dimension} result nor a participation boundary.`,
    },
    {
      prior: `I continue to refuse every ${item} inquiry, regardless of how it is described.`,
      current: `My blanket refusal stands: no ${item} evidence and no condition for participation.`,
    },
    {
      prior: `The people who designed the ${item} record probably had an agenda.`,
      current: `That suspicion is my entire answer; I identify no public defect, bounded result, or usable condition.`,
    },
    {
      prior: `The lighting in this room is more interesting than the proposed ${item} check.`,
      current: `I will discuss the room instead and leave the ${item} ${dimension} entries untouched.`,
    },
    {
      prior: `Perhaps I could join some future ${item} inquiry under terms I have not chosen.`,
      current: `I offer no present condition and make no comparison of the posted ${item} values.`,
    },
  ];
  const selected = variants[index % variants.length];
  return {
    prior: selected.prior,
    tutor: `State either the bounded ${item} ${dimension} result or one precise public condition for participating.`,
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

function exactReusedTextIssues(cases, consumedCases) {
  const consumedTexts = new Set(
    consumedCases.flatMap((row) => [
      ...FIELD_NAMES.map((field) => row[field]),
      ...(row.expected?.evidence || []).map((entry) => entry.text),
    ]),
  );
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
    id: `v5-${String(settings.indexOf(setting) * objects.length + objectIndex + 1).padStart(3, '0')}`,
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
const recoveryById = assign('v5-recovery-strata-20260822', base, recoveryLabels);
const registerById = assign('v5-register-strata-20260822', base, registerLabels);
const actionById = assign('v5-action-strata-20260822', base, actionLabels);
const positiveRows = base.filter((row) => recoveryById.get(row.id) !== 'no_recovery');
const dependentIds = new Set(
  ranked('v5-intervening-dependence-20260822', positiveRows)
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

const consumed = JSON.parse(fs.readFileSync(CONSUMED, 'utf8'));
const issues = validate(cases, consumed.cases);
if (issues.length) throw new Error(issues.join('; '));
if (fs.existsSync(OUTPUT)) throw new Error(`${path.relative(ROOT, OUTPUT)} already exists`);
const corpus = {
  schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v5',
  version: 5,
  role: 'genuinely_fresh_heldout_blinded',
  frozen: true,
  authored_after_instrument_freeze_commit: FREEZE_COMMIT,
  authoring_method: 'deterministic_coordinator_authored_stratified_paraphrase_generator_v1',
  judge_models_authored_gold_or_cases: false,
  prompt_examples_allowed: false,
  zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3: true,
  cases,
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(corpus, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(
  `${JSON.stringify({ status: 'created', path: path.relative(ROOT, OUTPUT), cases: cases.length, sha256: sha(fs.readFileSync(OUTPUT)) })}\n`,
);
