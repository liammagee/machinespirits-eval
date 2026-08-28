import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RECOVERY_LABELS = [
  ...Array(32).fill('merits_only'),
  ...Array(32).fill('grounded_only'),
  ...Array(16).fill('both'),
  ...Array(40).fill('no_recovery'),
];
const REGISTER_LABELS = [...Array(40).fill('warm'), ...Array(40).fill('plain'), ...Array(40).fill('neither')];
const ACTION_LABELS = [...Array(80).fill(true), ...Array(40).fill(false)];
const BOUNDARY_NEGATIVE_LABELS = [
  'generic_assent',
  'blanket_refusal',
  'ungrounded_suspicion',
  'off_topic',
  'unspecified_future_condition',
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

function renderPhrase(template, values) {
  return Object.entries(values).reduce(
    (rendered, [name, value]) => rendered.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}

function triggerFor(descriptor, item, index) {
  const variants = descriptor.phrases.triggers;
  return renderPhrase(variants[index % variants.length], { item });
}

function interventionFor(descriptor, { item, measure, register, actionPresent, index }) {
  const [dimension] = measure;
  const groups = actionPresent
    ? descriptor.phrases.interventions.actionPresent
    : descriptor.phrases.interventions.actionAbsent;
  const variants = groups[register];
  return renderPhrase(variants[index % variants.length], { item, dimension });
}

function positiveTurns(descriptor, { item, measure, left, right, stratum, interveningDependent, index }) {
  const [dimension, unit] = measure;
  const values = { item, dimension, unit, left, right, difference: right - left };
  const merits = renderPhrase(descriptor.phrases.positive.merits[index % 3], values);
  const condition = renderPhrase(descriptor.phrases.positive.conditions[index % 3], values);
  const combined = `${condition} ${merits}`;
  const recoveryText = stratum === 'merits_only' ? merits : stratum === 'grounded_only' ? condition : combined;
  if (interveningDependent) {
    return {
      prior: renderPhrase(descriptor.phrases.positive.dependent.prior, values),
      tutor: renderPhrase(descriptor.phrases.positive.dependent.tutor, values),
      current: recoveryText,
      evidenceSource: 'current_learner',
      meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
      conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
    };
  }
  return {
    prior: recoveryText,
    tutor: renderPhrase(descriptor.phrases.positive.independent.tutor, values),
    current: renderPhrase(descriptor.phrases.positive.independent.current, values),
    evidenceSource: 'prior_post_trigger',
    meritsText: ['merits_only', 'both'].includes(stratum) ? merits : null,
    conditionText: ['grounded_only', 'both'].includes(stratum) ? condition : null,
  };
}

function negativeTurns(descriptor, { item, measure, index }) {
  const [dimension] = measure;
  const values = { item, dimension };
  const selected = descriptor.phrases.negative.turns[index % descriptor.phrases.negative.turns.length];
  return {
    prior: renderPhrase(selected.prior, values),
    tutor: renderPhrase(descriptor.phrases.negative.tutor, values),
    current: renderPhrase(selected.current, values),
  };
}

function stringsIn(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

function exactReusedTextIssues(descriptor, cases, consumedCases) {
  const consumedTexts =
    descriptor.validation.consumedTextScope === 'legacy_fields_and_expected_evidence'
      ? new Set(
          consumedCases.flatMap((row) => [
            ...descriptor.fieldNames.map((field) => row[field]),
            ...(row.expected?.evidence || []).map((entry) => entry.text),
          ]),
        )
      : new Set(consumedCases.flatMap(stringsIn));

  return cases.flatMap((row) => [
    ...descriptor.fieldNames.flatMap((field) =>
      consumedTexts.has(row[field]) ? [`${row.case_id}:${field}:exact_consumed_text_reuse`] : [],
    ),
    ...[...row.expected.primary_evidence, ...row.expected.fidelity_evidence].flatMap((entry) =>
      consumedTexts.has(entry.text) ? [`${row.case_id}:${entry.field}:exact_consumed_evidence_reuse`] : [],
    ),
  ]);
}

export function validateTutorStubResistanceMeasurementHeldoutCorpus(descriptor, cases, consumedCases) {
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
    if (
      descriptor.validation.actionPlainOneSentence &&
      row.strata.action_present &&
      row.strata.register === 'plain' &&
      (row.intervention.match(/[.!?](?=\s|$)/gu) || []).length !== 1
    ) {
      issues.push(`${row.case_id}:action_plain_not_one_sentence`);
    }
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
  if (interveningDependent !== 24) {
    issues.push(`expected 24 intervening-dependent cases; found ${interveningDependent}`);
  }
  issues.push(...exactReusedTextIssues(descriptor, cases, consumedCases));
  return issues;
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

export function buildTutorStubResistanceMeasurementHeldoutCorpus(descriptor, consumedCases) {
  const base = descriptor.settings.flatMap((setting) =>
    descriptor.objects.map((object, objectIndex) => ({
      id: `v${descriptor.version}-${String(
        descriptor.settings.indexOf(setting) * descriptor.objects.length + objectIndex + 1,
      ).padStart(3, '0')}`,
      item: `${setting} ${object}`,
    })),
  );
  const recoveryById = assign(descriptor.seeds.recovery, base, RECOVERY_LABELS);
  const registerById = assign(descriptor.seeds.register, base, REGISTER_LABELS);
  const actionById = assign(descriptor.seeds.action, base, ACTION_LABELS);
  const positiveRows = base.filter((row) => recoveryById.get(row.id) !== 'no_recovery');
  const dependentIds = new Set(
    ranked(descriptor.seeds.interveningDependence, positiveRows)
      .slice(0, 24)
      .map((row) => row.id),
  );

  const cases = base.map((baseRow, index) => {
    const measure = descriptor.measures[index % descriptor.measures.length];
    const left = 11 + ((index * 7) % 83);
    const right = left + 2 + (index % 6);
    const stratum = recoveryById.get(baseRow.id);
    const register = registerById.get(baseRow.id);
    const actionPresent = actionById.get(baseRow.id);
    const row = {
      case_id: baseRow.id,
      trigger: triggerFor(descriptor, baseRow.item, index),
      intervention: interventionFor(descriptor, {
        item: baseRow.item,
        measure,
        register,
        actionPresent,
        index,
      }),
    };
    const turns =
      stratum === 'no_recovery'
        ? negativeTurns(descriptor, { item: baseRow.item, measure, index })
        : positiveTurns(descriptor, {
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
        boundary_negative: stratum === 'no_recovery' ? BOUNDARY_NEGATIVE_LABELS[index % 5] : null,
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

  const issues = validateTutorStubResistanceMeasurementHeldoutCorpus(descriptor, cases, consumedCases);
  if (issues.length) throw new Error(issues.join('; '));
  return { ...descriptor.metadata, cases };
}

export function renderTutorStubResistanceMeasurementHeldoutCorpusBytes(descriptor, consumedCases) {
  const corpus = buildTutorStubResistanceMeasurementHeldoutCorpus(descriptor, consumedCases);
  return Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`);
}

export function loadTutorStubResistanceMeasurementHeldoutConsumedCases(descriptor, root = REPO_ROOT) {
  return descriptor.consumedPaths.flatMap(
    (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')).cases,
  );
}

export function runTutorStubResistanceMeasurementHeldoutCli(
  descriptor,
  { root = REPO_ROOT, stdout = process.stdout } = {},
) {
  const consumedCases = loadTutorStubResistanceMeasurementHeldoutConsumedCases(descriptor, root);
  const bytes = renderTutorStubResistanceMeasurementHeldoutCorpusBytes(descriptor, consumedCases);
  const output = path.join(root, descriptor.outputPath);
  if (fs.existsSync(output)) throw new Error(`${path.relative(root, output)} already exists`);
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  stdout.write(
    `${JSON.stringify({
      status: 'created',
      path: path.relative(root, output),
      cases: JSON.parse(bytes).cases.length,
      sha256: sha(fs.readFileSync(output)),
    })}\n`,
  );
}
