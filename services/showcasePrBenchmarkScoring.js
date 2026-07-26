/**
 * Apply the PR-benchmark turn rubric (`config/tutor-pr-benchmark-rubric.yaml`)
 * to free-running showcase dialogues.
 *
 * The rubric was written for a different unit, and says so in its own header:
 * "One exact tutor candidate evaluated against one frozen public transcript
 * prefix, its case-specific criterion, and its frozen authored turn
 * obligations." A showcase turn has none of those three. It comes from a
 * dialogue where the tutor and an automated learner spoke freely, so there is no
 * case criterion, no authored part or tactic contract, and no frozen
 * question/closure contract.
 *
 * Four of the seven axes are therefore not askable here and are reported as
 * unavailable rather than passed — an axis nobody can judge is not an axis
 * everybody clears. Three transfer: `safety` and `learner_uptake` in full, and
 * `handoff` with two of its four fail clauses in force. The scoping is carried
 * in the output, not applied silently.
 *
 * Nothing here is an empirical claim, and none of it belongs in the paper as
 * one.
 */

export const SHOWCASE_PR_BENCHMARK_SCHEMA = 'machinespirits.tutor-stub.showcase-pr-benchmark.v1';

export const SHOWCASE_PR_BENCHMARK_LABELS = Object.freeze(['pass', 'fail', 'unsure']);

/**
 * Which of the rubric's axes survive the change of unit, and why.
 *
 * `scope: 'full'` means every clause of the axis is in force. `scope: 'partial'`
 * means the axis is asked with named clauses withheld — `clausesInForce` and
 * `clausesVoid` both reach the judge and both reach the artefact, so a reader
 * can see which question was actually put.
 */
export const SHOWCASE_PR_BENCHMARK_AXIS_TRANSFER = Object.freeze({
  safety: {
    applicable: true,
    scope: 'full',
    reason:
      'The visible transcript is the complete public record, so whether a claim is licensed by it is readable ' +
      'from the transcript alone. The axis carries its own unsure anchor for the case where the record does not ' +
      'settle whether a fact was already public.',
  },
  learner_uptake: {
    applicable: true,
    scope: 'full',
    reason: "The learner's prior visible move and the tutor's reply to it are both in the transcript.",
  },
  handoff: {
    applicable: true,
    scope: 'partial',
    reason:
      'Half the axis reads the text and half reads an authored question/closure contract that a free-running turn ' +
      'does not have.',
    clausesInForce: [
      'the ending keeps the unresolved target explicit',
      'the ending does not reopen settled work',
      'the response does not lose the live target',
      'the response does not create multiple competing terminal questions',
    ],
    clausesVoid: [
      'whether the terminal question was the one licensed question',
      'whether a question was forbidden by the handoff contract',
      'whether a question was required by the handoff contract',
    ],
  },
  overall_delivery: {
    applicable: false,
    reason:
      'The composite axis is acceptance against a case-specific criterion, and no criterion exists for a turn the ' +
      'dialogue produced freely. Its decision rule also fails on any hard-axis failure, and two of the five hard ' +
      'axes are themselves unavailable here.',
  },
  evidence_discipline: {
    applicable: false,
    reason:
      'The axis asks whether evidence was released on time and in the right order, which is a question about the ' +
      'private release schedule rather than about the text. Supplying that schedule to the judge would also break ' +
      'arm symmetry, since the bare arm never builds one.',
  },
  actorial_part: {
    applicable: false,
    reason: 'There is no authored public part contract for the turn, so there is nothing to check realization against.',
  },
  performance_tactic: {
    applicable: false,
    reason: 'There is no authored performance tactic contract for the turn.',
  },
});

function transferFor(axisId) {
  const transfer = SHOWCASE_PR_BENCHMARK_AXIS_TRANSFER[axisId];
  if (!transfer) throw new Error(`no showcase transfer decision recorded for rubric axis ${axisId}`);
  return transfer;
}

/**
 * Split the rubric's axes into the ones this instrument asks and the ones it
 * declines to ask. Every axis in the rubric must appear in exactly one list, so
 * a new axis added upstream fails loudly here rather than being dropped.
 */
export function showcasePrBenchmarkAxes(rubric) {
  const inForce = [];
  const unavailable = [];
  for (const [axisId, axis] of Object.entries(rubric?.axes || {})) {
    const transfer = transferFor(axisId);
    if (transfer.applicable) {
      inForce.push({ axisId, axis, ...transfer });
    } else {
      unavailable.push({ axisId, title: axis.title, reason: transfer.reason });
    }
  }
  if (!inForce.length) throw new Error('no rubric axis transfers to a free-running showcase turn');
  return { inForce, unavailable };
}

function axisBlock({ axisId, axis, scope, clausesInForce, clausesVoid }) {
  const lines = [
    `### ${axisId} — ${axis.title}`,
    `Construct: ${axis.construct}`,
    `Question: ${axis.question}`,
    `Pass when: ${axis.pass_anchor}`,
    `Fail when: ${axis.fail_anchor}`,
    `Unsure when: ${axis.unsure_anchor}`,
    'Do not fail for:',
    ...axis.exclusions.map((exclusion) => `  - ${exclusion}`),
  ];
  if (scope === 'partial') {
    lines.push('Scoped for this unit. Only these parts of the anchors are in force:');
    lines.push(...clausesInForce.map((clause) => `  IN FORCE: ${clause}`));
    lines.push('These parts are NOT in force, because they depend on an authored contract this turn does not have:');
    lines.push(...clausesVoid.map((clause) => `  VOID: ${clause}`));
    lines.push('If your only concern is a void clause, answer pass. Do not answer fail or unsure on that basis.');
  } else {
    lines.push('Applies here in full.');
  }
  return lines.join('\n');
}

/**
 * The public record before the scored turn: the opening move and every
 * completed exchange up to it. Nothing private is included — no proof DAG, no
 * release plan, no guard verdicts — so both arms are asked about what a learner
 * actually saw.
 */
export function showcasePriorTurns(dialogue, turnIndex) {
  const lines = [];
  if (dialogue?.openingText) lines.push(`Tutor (opening): ${dialogue.openingText}`);
  for (const turn of dialogue?.turns || []) {
    if (turn.index >= turnIndex) break;
    lines.push(`Learner: ${turn.learner?.text || ''}`);
    lines.push(`Tutor: ${turn.tutor?.text || ''}`);
  }
  return lines.join('\n\n').trim();
}

export function buildShowcasePrBenchmarkPrompt({ rubric, axes, scenario, priorTurns, learnerText, candidateText }) {
  const axisIds = axes.map((entry) => entry.axisId);
  return [
    'You are scoring one tutor turn from a tutoring dialogue against a fixed rubric.',
    '',
    '## What this unit is, and what it is not',
    '',
    `The rubric below was written for a different unit: ${rubric.unit}`,
    '',
    'This is not that unit. The turn you are about to see comes from a free-running dialogue: a tutor and an',
    'automated learner spoke to each other with nothing scripted in advance. There is therefore NO case-specific',
    'acceptance criterion, NO authored speaking part or performance tactic, and NO frozen question or closure',
    'contract for this turn. Do not imagine one. Do not treat its absence as a defect. The rubric axes that depend',
    'on those contracts have been withheld from you rather than asked and failed; you are being asked only about',
    `the axes below (${axisIds.join(', ')}).`,
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
    ...SHOWCASE_PR_BENCHMARK_LABELS.map((label) => `${label}: ${rubric.labels?.[label] || ''}`),
    '',
    '## Rules',
    '',
    '- Judge the exact turn shown, not an imagined repair or continuation.',
    "- Use only the public record shown, the learner's move on this turn, and the tutor turn itself.",
    '- The public record shown is complete. Anything not in it had not been made available to the learner.',
    '- Do not infer concealed facts, model identity, guard or audit output, or later learner uptake.',
    '- Do not double-penalize one defect merely because it appears under more than one axis.',
    '',
    '## Dialogue',
    '',
    `Scenario: ${scenario?.label || scenario?.id || 'unnamed'}`,
    scenario?.summary ? `Summary: ${scenario.summary}` : null,
    '',
    '### Public record before this turn',
    '',
    // The baseline arm runs in passthrough and emits no opening move, so on its
    // first turn there is genuinely nothing prior. That is a real difference in
    // what the learner saw, not a gap to paper over.
    priorTurns || '(nothing precedes this turn: it is the first exchange and the tutor made no opening move)',
    '',
    '### The learner move this turn answers',
    '',
    `Learner: ${learnerText || ''}`,
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

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('judge response contained no JSON object');
  return JSON.parse(body.slice(start, end + 1));
}

export function parseShowcasePrBenchmarkVerdict(text, axisIds) {
  const parsed = extractJsonObject(text);
  const axes = {};
  for (const axisId of axisIds) {
    const entry = parsed?.[axisId];
    const label = String(entry?.label || '')
      .trim()
      .toLowerCase();
    if (!SHOWCASE_PR_BENCHMARK_LABELS.includes(label)) {
      throw new Error(`judge returned an invalid label for ${axisId}: ${JSON.stringify(entry?.label ?? null)}`);
    }
    axes[axisId] = { label, rationale: String(entry?.rationale || '').trim() || null };
  }
  return axes;
}

/**
 * A verdict over the axes that are in force, and only those. This is NOT the
 * rubric's `overall_delivery`: that axis is a composite over the full hard set
 * against a case criterion, two members of which are unavailable here. Naming it
 * separately keeps a showcase number from being read against a benchmark-lane
 * one.
 */
export function showcaseTransferableVerdict(axes) {
  const labels = Object.values(axes || {}).map((entry) => entry.label);
  if (!labels.length) return null;
  if (labels.includes('fail')) return 'fail';
  if (labels.includes('unsure')) return 'unsure';
  return 'pass';
}

/**
 * The rubric's `safety` axis has a machine rule, and the audit behind it — the
 * leak audit — runs on both arms: it is one of the two contract-free audits the
 * baseline's `--observe-audits` mode records. Reported beside the judge label as
 * an independent channel, never merged into it.
 */
export function showcaseMachineSafetyLabel(turn) {
  const audits = turn?.tutor?.audits;
  if (!Array.isArray(audits)) return null;
  const leak = audits.find((audit) => audit.key === 'tutorLeakAudit');
  if (!leak) return null;
  return leak.ok === false ? 'fail' : 'pass';
}

/**
 * Per-arm, per-axis label counts. The denominator is turns scored, and pass,
 * fail and unsure are all reported: a fail rate alone would let a run where the
 * judge could not tell read as a clean one.
 */
export function summarizeShowcasePrBenchmarkRows(rows, axisIds) {
  const byArm = new Map();
  for (const row of rows) {
    if (!byArm.has(row.armId)) byArm.set(row.armId, []);
    byArm.get(row.armId).push(row);
  }
  const summary = [];
  for (const [armId, armRows] of byArm) {
    const scored = armRows.filter((row) => row.success);
    const axes = {};
    for (const axisId of axisIds) {
      const counts = { pass: 0, fail: 0, unsure: 0 };
      for (const row of scored) {
        const label = row.axes?.[axisId]?.label;
        if (label && counts[label] !== undefined) counts[label] += 1;
      }
      axes[axisId] = { ...counts, scored: scored.length };
    }
    summary.push({
      armId,
      turnsScored: scored.length,
      turnsFailed: armRows.length - scored.length,
      axes,
      transferableVerdict: {
        pass: scored.filter((row) => row.transferableVerdict === 'pass').length,
        fail: scored.filter((row) => row.transferableVerdict === 'fail').length,
        unsure: scored.filter((row) => row.transferableVerdict === 'unsure').length,
      },
      machineSafety: {
        pass: scored.filter((row) => row.machineSafetyLabel === 'pass').length,
        fail: scored.filter((row) => row.machineSafetyLabel === 'fail').length,
        unavailable: scored.filter((row) => row.machineSafetyLabel === null).length,
      },
    });
  }
  return summary;
}
