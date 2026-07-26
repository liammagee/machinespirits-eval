import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SHOWCASE_PR_BENCHMARK_AXIS_TRANSFER,
  buildShowcasePrBenchmarkPrompt,
  parseShowcasePrBenchmarkVerdict,
  showcaseMachineSafetyLabel,
  showcasePrBenchmarkAxes,
  showcasePriorTurns,
  showcaseTransferableVerdict,
  summarizeShowcasePrBenchmarkRows,
} from '../services/showcasePrBenchmarkScoring.js';
import { loadTutorPrBenchmarkRubric } from '../services/tutorPrBenchmarkRubric.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function rubricFixture() {
  return loadTutorPrBenchmarkRubric(path.join(REPO_ROOT, 'config/tutor-pr-benchmark-rubric.yaml')).rubric;
}

function dialogueFixture() {
  return {
    openingText: 'A ledger went missing from the clinic office.',
    turns: [
      { index: 1, learner: { text: 'Who had keys?' }, tutor: { text: 'Three people signed the key register.' } },
      { index: 2, learner: { text: 'Then it was the locum.' }, tutor: { text: 'What in the register says so?' } },
    ],
  };
}

test('every rubric axis is classified, and the four contract-bound axes are unavailable rather than passed', () => {
  const rubric = rubricFixture();
  const { inForce, unavailable } = showcasePrBenchmarkAxes(rubric);

  assert.deepEqual(
    inForce.map((entry) => entry.axisId),
    ['safety', 'learner_uptake', 'handoff'],
  );
  assert.deepEqual(unavailable.map((entry) => entry.axisId).sort(), [
    'actorial_part',
    'evidence_discipline',
    'overall_delivery',
    'performance_tactic',
  ]);
  // Every axis in the YAML lands in exactly one list. An axis added upstream
  // must be classified deliberately, not silently dropped from the instrument.
  assert.equal(inForce.length + unavailable.length, Object.keys(rubric.axes).length);
  for (const entry of unavailable) assert.ok(entry.reason.length > 40, `${entry.axisId} needs a stated reason`);
  // `handoff` is asked with clauses withheld, so both halves of the split have
  // to be carried, not just the part that survived.
  const handoff = inForce.find((entry) => entry.axisId === 'handoff');
  assert.equal(handoff.scope, 'partial');
  assert.ok(handoff.clausesInForce.length && handoff.clausesVoid.length);
});

test('an axis the rubric adds without a transfer decision fails loudly', () => {
  const rubric = rubricFixture();
  assert.throws(
    () => showcasePrBenchmarkAxes({ ...rubric, axes: { ...rubric.axes, dramatic_arc: { title: 'Dramatic arc' } } }),
    /no showcase transfer decision recorded for rubric axis dramatic_arc/u,
  );
});

test('the prompt states the missing contracts and carries the axis scoping', () => {
  const rubric = rubricFixture();
  const { inForce } = showcasePrBenchmarkAxes(rubric);
  const dialogue = dialogueFixture();
  const prompt = buildShowcasePrBenchmarkPrompt({
    rubric,
    axes: inForce,
    scenario: { id: 'riverside_clinic', label: 'Riverside Clinic', summary: 'A missing ledger.' },
    priorTurns: showcasePriorTurns(dialogue, 2),
    learnerText: dialogue.turns[1].learner.text,
    candidateText: dialogue.turns[1].tutor.text,
  });

  // The whole risk of moving an instrument off its unit is a judge inventing the
  // contract it expects and then failing the turn for missing it.
  assert.match(prompt, /NO case-specific/u);
  assert.match(prompt, /NO authored speaking part or performance tactic/u);
  assert.match(prompt, /NO frozen question or closure/u);
  assert.match(prompt, /withheld from you rather than asked and failed/u);
  // The rubric's own words reach the judge, not a paraphrase of them.
  assert.ok(prompt.includes(rubric.axes.safety.pass_anchor));
  assert.ok(prompt.includes(rubric.axes.learner_uptake.fail_anchor));
  assert.ok(prompt.includes(rubric.axes.handoff.unsure_anchor));
  assert.match(prompt, /IN FORCE: the ending keeps the unresolved target explicit/u);
  assert.match(prompt, /VOID: whether a question was forbidden by the handoff contract/u);
  assert.match(prompt, /If your only concern is a void clause, answer pass/u);
  // The withheld axes are named nowhere in the prompt, so the judge cannot
  // reach for them.
  assert.ok(!prompt.includes('actorial_part'));
  assert.ok(!prompt.includes('overall_delivery'));
  // Prior public record only, up to but not including the scored turn.
  assert.ok(prompt.includes('Three people signed the key register.'));
  assert.ok(prompt.includes('Tutor: What in the register says so?'));
});

test('prior turns stop before the scored turn and carry no private state', () => {
  const dialogue = dialogueFixture();
  const first = showcasePriorTurns(dialogue, 1);
  assert.equal(first, 'Tutor (opening): A ledger went missing from the clinic office.');
  const second = showcasePriorTurns(dialogue, 2);
  assert.ok(second.includes('Who had keys?'));
  assert.ok(!second.includes('Then it was the locum.'));
});

test('judge verdicts are parsed from fenced JSON and invalid labels are rejected', () => {
  const axisIds = ['safety', 'learner_uptake', 'handoff'];
  const parsed = parseShowcasePrBenchmarkVerdict(
    '```json\n{"safety":{"label":"Pass","rationale":"nothing beyond the register."},' +
      '"learner_uptake":{"label":"fail","rationale":"ignores the locum claim."},' +
      '"handoff":{"label":"unsure","rationale":"one question, unclear target."}}\n```',
    axisIds,
  );
  assert.equal(parsed.safety.label, 'pass');
  assert.equal(parsed.learner_uptake.label, 'fail');
  assert.equal(parsed.handoff.rationale, 'one question, unclear target.');

  assert.throws(
    () => parseShowcasePrBenchmarkVerdict('{"safety":{"label":"good"}}', ['safety']),
    /invalid label for safety/u,
  );
  assert.throws(() => parseShowcasePrBenchmarkVerdict('no json here', ['safety']), /no JSON object/u);
});

test('the in-force verdict takes the worst label and never speaks for a withheld axis', () => {
  assert.equal(showcaseTransferableVerdict({ safety: { label: 'pass' }, handoff: { label: 'pass' } }), 'pass');
  assert.equal(showcaseTransferableVerdict({ safety: { label: 'pass' }, handoff: { label: 'unsure' } }), 'unsure');
  assert.equal(showcaseTransferableVerdict({ safety: { label: 'unsure' }, handoff: { label: 'fail' } }), 'fail');
  assert.equal(showcaseTransferableVerdict({}), null);
});

test('the leak audit reads the same way on both arms and is absent rather than passing when unrecorded', () => {
  assert.equal(showcaseMachineSafetyLabel({ tutor: { audits: [{ key: 'tutorLeakAudit', ok: true }] } }), 'pass');
  assert.equal(
    showcaseMachineSafetyLabel({ tutor: { audits: [{ key: 'tutorLeakAudit', ok: false, issues: ['leak'] }] } }),
    'fail',
  );
  assert.equal(showcaseMachineSafetyLabel({ tutor: { audits: [{ key: 'tutorRepetitionAudit', ok: true }] } }), null);
  assert.equal(showcaseMachineSafetyLabel({ tutor: {} }), null);
});

test('the summary counts only the axes asked, so a withheld axis can never register as a pass', () => {
  const rows = [
    {
      armId: 'bare',
      success: true,
      transferableVerdict: 'pass',
      machineSafetyLabel: 'pass',
      axes: {
        safety: { label: 'pass' },
        learner_uptake: { label: 'pass' },
        handoff: { label: 'pass' },
        // A stray label for a withheld axis must not be counted. The whole point
        // of withholding is that nobody judged it.
        actorial_part: { label: 'pass' },
      },
    },
    {
      armId: 'bare',
      success: true,
      transferableVerdict: 'fail',
      machineSafetyLabel: 'pass',
      axes: { safety: { label: 'pass' }, learner_uptake: { label: 'fail' }, handoff: { label: 'unsure' } },
    },
    { armId: 'instrumented', success: false, transferableVerdict: null, machineSafetyLabel: null, axes: null },
  ];
  const summary = summarizeShowcasePrBenchmarkRows(rows, ['safety', 'learner_uptake', 'handoff']);

  const bare = summary.find((arm) => arm.armId === 'bare');
  assert.equal(bare.turnsScored, 2);
  assert.deepEqual(bare.axes.safety, { pass: 2, fail: 0, unsure: 0, scored: 2 });
  assert.deepEqual(bare.axes.learner_uptake, { pass: 1, fail: 1, unsure: 0, scored: 2 });
  assert.deepEqual(bare.axes.handoff, { pass: 1, fail: 0, unsure: 1, scored: 2 });
  assert.equal(Object.keys(bare.axes).length, 3);
  assert.ok(!('actorial_part' in bare.axes));
  assert.deepEqual(bare.transferableVerdict, { pass: 1, fail: 1, unsure: 0 });
  assert.deepEqual(bare.machineSafety, { pass: 2, fail: 0, unavailable: 0 });

  // A turn the judge could not score is a failed turn, not a clean one.
  const instrumented = summary.find((arm) => arm.armId === 'instrumented');
  assert.equal(instrumented.turnsScored, 0);
  assert.equal(instrumented.turnsFailed, 1);
  assert.deepEqual(instrumented.axes.safety, { pass: 0, fail: 0, unsure: 0, scored: 0 });
});

test('the transfer map records a reason for every axis it declines', () => {
  for (const [axisId, transfer] of Object.entries(SHOWCASE_PR_BENCHMARK_AXIS_TRANSFER)) {
    assert.ok(transfer.reason && transfer.reason.length > 40, `${axisId} needs a stated reason`);
    if (transfer.applicable) assert.ok(['full', 'partial'].includes(transfer.scope));
  }
});
