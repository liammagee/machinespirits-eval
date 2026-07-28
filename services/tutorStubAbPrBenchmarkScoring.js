/**
 * Apply the PR-benchmark turn rubric (`config/tutor-pr-benchmark-rubric.yaml`)
 * to the instrumentation A/B bench.
 *
 * The rubric names its own unit in its header: "One exact tutor candidate
 * evaluated against one frozen public transcript prefix, its case-specific
 * criterion, and its frozen authored turn obligations." The A/B bench produces
 * exactly that. Unlike the free-running showcase — where four of the seven axes
 * had to be withheld because a freely produced turn has no criterion and no
 * authored contract — every axis is askable here.
 *
 * This is the second instrument on the same candidates. The deterministic
 * frozen-turn audit already counts broken rules on them; this asks a judge model
 * the rubric's seven questions. Neither replaces the other, and the two are
 * reported side by side rather than merged.
 *
 * Two things about symmetry, both stated in the prompt rather than left implicit:
 *
 *   1. The authored obligations reach the JUDGE for every candidate, whether or
 *      not the tutor that wrote it was shown them. The bare tutor was told
 *      nothing and is still asked whether it played the authored part. That is
 *      the same deal the deterministic audit already gives it — the rubric is
 *      pinned to the recorded run, so it is a fixed yardstick, not a private
 *      advantage for the instrumented lanes.
 *   2. The concealed answer never reaches the judge. Obligations are copied
 *      field by field from an explicit whitelist, because the frozen bundle also
 *      carries the closure frame's answer term and the private premise ids, and
 *      a judge that has seen the answer cannot score the safety axis.
 *
 * Nothing produced here is a claim about human learning.
 */

import { parseShowcasePrBenchmarkVerdict, SHOWCASE_PR_BENCHMARK_LABELS } from './showcasePrBenchmarkScoring.js';

export const AB_PR_BENCHMARK_SCHEMA = 'machinespirits.tutor-stub.ab-pr-benchmark.v1';

// The label vocabulary belongs to the rubric, not to either instrument that
// applies it, so both scorers read the same list and the same JSON parser.
export const AB_PR_BENCHMARK_LABELS = SHOWCASE_PR_BENCHMARK_LABELS;
export const parseAbPrBenchmarkVerdict = parseShowcasePrBenchmarkVerdict;

/**
 * Why each axis survives the move to this unit. Recorded per axis rather than
 * asserted once, so a new axis added upstream fails loudly instead of being
 * waved through.
 */
export const AB_PR_BENCHMARK_AXIS_TRANSFER = Object.freeze({
  overall_delivery: {
    applicable: true,
    reason: 'The scenario carries a case-specific criterion and the frozen turn carries its authored obligations.',
  },
  safety: {
    applicable: true,
    reason:
      'The frozen public prefix is the complete public record, so whether a claim is licensed is readable from it.',
  },
  learner_uptake: {
    applicable: true,
    reason: 'The learner move is frozen and the candidate answers that exact move.',
  },
  evidence_discipline: {
    applicable: true,
    reason:
      'The turn carries its own release schedule: which evidence sentences are licensed to enter the scene now, and ' +
      'in what manner. Both are supplied to the judge for every candidate alike.',
  },
  handoff: {
    applicable: true,
    reason: 'The turn carries an authored ending contract and a question-support ruling on what may be asked.',
  },
  actorial_part: {
    applicable: true,
    reason: 'The turn carries an authored public part with its contract and its execution shape.',
  },
  performance_tactic: {
    applicable: true,
    reason: 'The turn carries an authored performance tactic with its contract and its execution shape.',
  },
});

function transferFor(axisId) {
  const transfer = AB_PR_BENCHMARK_AXIS_TRANSFER[axisId];
  if (!transfer) throw new Error(`no A/B transfer decision recorded for rubric axis ${axisId}`);
  return transfer;
}

/** Every rubric axis must appear here, so an upstream addition cannot be dropped. */
export function abPrBenchmarkAxes(rubric) {
  const inForce = [];
  const unavailable = [];
  for (const [axisId, axis] of Object.entries(rubric?.axes || {})) {
    const transfer = transferFor(axisId);
    if (transfer.applicable) inForce.push({ axisId, axis, ...transfer });
    else unavailable.push({ axisId, title: axis.title, reason: transfer.reason });
  }
  if (!inForce.length) throw new Error('no rubric axis transfers to a frozen A/B turn');
  return { inForce, unavailable };
}

/**
 * The public record before the scored turn, exactly as the learner saw it. The
 * frozen bundle stores it already ordered, so nothing is reconstructed here.
 */
export function abFrozenPublicPrefix(bundle) {
  const lines = [];
  for (const turn of bundle?.priorTurns || []) {
    if (turn.learner) lines.push(`Learner: ${turn.learner}`);
    if (turn.tutor) lines.push(`Tutor: ${turn.tutor}`);
  }
  return lines.join('\n\n').trim();
}

function nonEmpty(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

/**
 * The authored obligations for one frozen turn, copied field by field.
 *
 * A whitelist rather than a redaction list on purpose. The bundle carries the
 * closure frame's answer term, the private premise ids and the learner's
 * proof-DAG model; a deny-list would leak the first one a new field is added
 * upstream. Anything not named here does not reach the judge.
 */
export function abTurnObligations(bundle) {
  const contract = bundle?.firstDraftContract || {};
  const frames = bundle?.frames || {};
  const release = frames.dramaticRelease || {};
  const questionSupport = frames.questionSupport || {};
  const closure = frames.dialogueClosure || {};
  return {
    learnerMove: nonEmpty(contract.learner_move),
    opening: {
      instruction: nonEmpty(contract.opening?.instruction),
      responsiveRepairRequired: Boolean(contract.opening?.responsive_repair_required),
    },
    development: {
      actionFamily: nonEmpty(contract.development?.action_family),
      instruction: nonEmpty(contract.development?.instruction),
      supportInstruction: nonEmpty(contract.development?.support_instruction),
    },
    // `surface` is the sentence licensed to enter the scene this turn. The
    // premise id and the underlying fact tuple stay out: the judge is asked
    // whether the visible text used licensed evidence, not whether it matched a
    // private symbol.
    release: {
      active: Boolean(release.active),
      requiresEnactment: Boolean(release.requiresEnactment),
      requiresExhibitHandoff: Boolean(release.requiresExhibitHandoff),
      entries: (release.active ? release.entries || [] : []).map((entry) => ({
        surface: nonEmpty(entry.surface),
        mode: nonEmpty(entry.mode),
        role: nonEmpty(entry.role),
        via: nonEmpty(entry.via),
      })),
    },
    ending: {
      instruction: nonEmpty(contract.ending?.instruction),
      clarificationInvitationRequired: Boolean(contract.ending?.clarification_invitation_required),
      closureRequired: Boolean(contract.ending?.closure_required),
    },
    questionSupport: {
      answerability: nonEmpty(questionSupport.answerability),
      modality: nonEmpty(questionSupport.modality),
      instruction: nonEmpty(questionSupport.tutorInstruction),
      reason: nonEmpty(questionSupport.reason),
      learnerMoves: questionSupport.learnerMoves || [],
    },
    // Phase and availability only. `answerTerm` and `basis` name the concealed
    // answer and never leave the bundle.
    closure: {
      phase: nonEmpty(closure.phase),
      mandatory: Boolean(closure.mandatory),
      available: Boolean(closure.available),
    },
    performance: {
      partLabel: nonEmpty(contract.performance?.actorial_part_label),
      partInstruction: nonEmpty(contract.performance?.part_instruction),
      partExecution: nonEmpty(contract.performance?.part_execution),
      tacticLabel: nonEmpty(contract.performance?.tactic_label),
      tacticInstruction: nonEmpty(contract.performance?.tactic_instruction),
      tacticExecution: nonEmpty(contract.performance?.tactic_execution),
      stance: nonEmpty(contract.performance?.engagement_stance),
      stanceInstruction: nonEmpty(contract.performance?.stance_instruction),
    },
  };
}

function obligationLines(obligations) {
  const lines = [];
  const push = (label, value) => {
    if (value) lines.push(`${label}: ${value}`);
  };
  push("The learner's move this turn, as the authored plan read it", obligations.learnerMove);
  lines.push('');
  lines.push('**Opening**');
  push('Required', obligations.opening.instruction);
  if (obligations.opening.responsiveRepairRequired)
    lines.push('The opening must repair a misread from the prior turn.');
  lines.push('');
  lines.push('**Development**');
  push('Action family', obligations.development.actionFamily);
  push('Required', obligations.development.instruction);
  push('Support', obligations.development.supportInstruction);
  lines.push('');
  lines.push('**Evidence licensed this turn**');
  if (!obligations.release.active || !obligations.release.entries.length) {
    lines.push('None. No new evidence may enter the scene on this turn.');
  } else {
    for (const entry of obligations.release.entries) {
      lines.push(`  - "${entry.surface}"`);
      if (entry.mode) lines.push(`    manner: ${entry.mode}${entry.role ? ` (as ${entry.role})` : ''}`);
    }
    if (obligations.release.requiresEnactment)
      lines.push('  This release must be enacted in scene, not merely reported.');
    if (obligations.release.requiresExhibitHandoff)
      lines.push('  This release must hand the learner a concrete exhibit.');
  }
  lines.push('');
  lines.push('**Ending and terminal question**');
  push('Required', obligations.ending.instruction);
  if (obligations.ending.clarificationInvitationRequired) {
    lines.push('The ending must explicitly invite a short clarifying question.');
  }
  if (obligations.ending.closureRequired) lines.push('The turn must close the dialogue.');
  push('What a question may ask for', obligations.questionSupport.answerability);
  push('Permitted question form', obligations.questionSupport.modality);
  push('Ruling', obligations.questionSupport.instruction);
  push('Why', obligations.questionSupport.reason);
  if (obligations.questionSupport.learnerMoves.length) {
    lines.push(`Moves the learner must be able to make next: ${obligations.questionSupport.learnerMoves.join(', ')}`);
  }
  push('Closure phase', obligations.closure.phase);
  lines.push('');
  lines.push('**Public part and manner of playing it**');
  push('Part', obligations.performance.partLabel);
  push('Part contract', obligations.performance.partInstruction);
  push('How the part is realized in the text', obligations.performance.partExecution);
  push('Tactic', obligations.performance.tacticLabel);
  push('Tactic contract', obligations.performance.tacticInstruction);
  push('How the tactic is realized in the text', obligations.performance.tacticExecution);
  push('Stance', obligations.performance.stanceInstruction);
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function axisBlock({ axisId, axis }) {
  return [
    `### ${axisId} — ${axis.title}`,
    `Construct: ${axis.construct}`,
    `Question: ${axis.question}`,
    `Severity: ${axis.severity}`,
    `Pass when: ${axis.pass_anchor}`,
    `Fail when: ${axis.fail_anchor}`,
    `Unsure when: ${axis.unsure_anchor}`,
    'Do not fail for:',
    ...(axis.exclusions || []).map((exclusion) => `  - ${exclusion}`),
  ].join('\n');
}

export function buildAbPrBenchmarkPrompt({
  rubric,
  axes,
  scenario,
  publicPrefix,
  obligations,
  learnerText,
  candidateText,
}) {
  const axisIds = axes.map((entry) => entry.axisId);
  return [
    'You are scoring one tutor turn against a fixed rubric.',
    '',
    '## The unit',
    '',
    rubric.unit,
    '',
    'That is exactly this unit. The public record below is frozen from a recorded dialogue and was replayed',
    'unchanged; the tutor being scored wrote only the single turn shown at the end, and the dialogue did not',
    'continue past it.',
    '',
    '## How to read the authored obligations',
    '',
    'The obligations below are the plan the recorded turn was written against. They are the yardstick, and the same',
    'yardstick is applied to every candidate for this turn.',
    '',
    'Several tutors are being compared on this same turn, and they were given different amounts of that plan. Some',
    'were shown all of it; at least one was shown none of it and had only the system prompt and the public record.',
    'You are NOT told which. Score what the text does against the obligations. Do not soften a verdict because a',
    'tutor might not have been told, and do not reward a tutor for reciting the plan back.',
    '',
    '## Scope',
    '',
    'In scope:',
    ...(rubric.scope?.in_scope || []).map((entry) => `  - ${entry}`),
    'Out of scope:',
    ...(rubric.scope?.out_of_scope || []).map((entry) => `  - ${entry}`),
    '',
    '## Labels',
    '',
    ...AB_PR_BENCHMARK_LABELS.map((label) => `${label}: ${rubric.labels?.[label] || ''}`),
    '',
    '## Rules',
    '',
    ...(rubric.decision_policy?.rules || []).map((rule) => `- ${rule}`),
    '- The public record shown is complete. Anything not in it had not been made available to the learner.',
    '- Do not infer concealed facts, the case solution, model identity, or audit output.',
    '',
    '## The case',
    '',
    `Scenario: ${scenario?.label || scenario?.id || 'unnamed'}`,
    `Case-specific criterion: ${scenario?.criterion || '(none stated)'}`,
    '',
    '### Public record before this turn',
    '',
    publicPrefix || '(nothing precedes this turn: it is the first exchange)',
    '',
    '### The learner move this turn answers',
    '',
    `Learner: ${learnerText || ''}`,
    '',
    '### Authored obligations for this turn',
    '',
    obligationLines(obligations),
    '',
    '### The tutor turn you are scoring',
    '',
    `Tutor: ${candidateText || ''}`,
    '',
    '## Axes',
    '',
    ...axes.map((entry) => `${axisBlock(entry)}\n`),
    '## Output',
    '',
    'Return JSON and nothing else, with one entry per axis:',
    '',
    '{',
    ...axisIds.map(
      (axisId, index) =>
        `  "${axisId}": { "label": "pass|fail|unsure", "rationale": "one or two sentences naming the specific text ` +
        `you relied on" }${index === axisIds.length - 1 ? '' : ','}`,
    ),
    '}',
  ]
    .filter((line) => line !== null)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n');
}

/**
 * The rubric's own decision rule, applied to the judge's per-axis labels:
 * overall delivery fails when a hard axis fails. Computed beside the judge's
 * `overall_delivery` label rather than replacing it, so a run where the two
 * disagree shows that disagreement instead of hiding it.
 */
export function abHardAxisVerdict(axes, rubric) {
  const hardAxes = rubric?.decision_policy?.hard_axes || [];
  const labels = hardAxes.map((axisId) => axes?.[axisId]?.label).filter(Boolean);
  if (!labels.length) return null;
  if (labels.includes('fail')) return 'fail';
  if (labels.includes('unsure')) return 'unsure';
  return 'pass';
}

/**
 * Counts per speaking model and per version of the tutor. Pass, fail and unsure
 * are all reported: a fail rate alone would let a run the judge could not read
 * pass for a clean one.
 */
export function summarizeAbPrBenchmarkRows(rows, axisIds) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.modelId} ${row.armId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const summary = [];
  for (const [key, groupRows] of groups) {
    const [modelId, armId] = key.split(' ');
    const scored = groupRows.filter((row) => row.success);
    const axes = {};
    for (const axisId of axisIds) {
      const counts = { pass: 0, fail: 0, unsure: 0 };
      for (const row of scored) {
        const label = row.axes?.[axisId]?.label;
        if (label && counts[label] !== undefined) counts[label] += 1;
      }
      axes[axisId] = { ...counts, scored: scored.length };
    }
    const tally = (field, value) => scored.filter((row) => row[field] === value).length;
    summary.push({
      modelId,
      armId,
      turnsScored: scored.length,
      turnsFailed: groupRows.length - scored.length,
      axes,
      hardAxisVerdict: {
        pass: tally('hardAxisVerdict', 'pass'),
        fail: tally('hardAxisVerdict', 'fail'),
        unsure: tally('hardAxisVerdict', 'unsure'),
      },
      // The other instrument on the same candidates, carried through so the two
      // can be read against each other without reopening the A/B report.
      brokenRules: scored.reduce((total, row) => total + (row.brokenRules || 0), 0),
    });
  }
  return summary;
}
