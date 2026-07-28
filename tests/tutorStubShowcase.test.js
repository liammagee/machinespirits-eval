import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertTutorStubShowcaseLearnerParity,
  buildTutorStubShowcasePlan,
  loadTutorStubShowcaseConfig,
  parseTutorStubShowcaseTrace,
  publicTutorStubShowcasePlan,
  renderTutorStubShowcaseMarkdown,
  runTutorStubShowcase,
  summarizeTutorStubShowcase,
  tutorStubShowcaseParityResidue,
  TUTOR_STUB_SHOWCASE_ARM_FLAGS,
  TUTOR_STUB_SHOWCASE_AUDIT_KEYS,
  TUTOR_STUB_SHOWCASE_CONFIG_SCHEMA,
  TUTOR_STUB_SHOWCASE_GUARD_KEYS,
  classifyGuardOutcome,
  validateTutorStubShowcaseConfig,
} from '../services/tutorStubShowcase.js';
import { renderTutorStubShowcaseHtml } from '../services/tutorStubShowcaseHtml.js';
import { buildShowcaseScoreOverlay } from '../services/tutorStubShowcaseScoreOverlay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-stub-showcase.yaml');

function plan(preset = 'smoke', overrides = {}) {
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  return buildTutorStubShowcasePlan({
    config: loaded.config,
    preset,
    configSha256: loaded.configSha256,
    ...overrides,
  });
}

/**
 * A minimal but structurally faithful trace: opening, N turns, an ending.
 *
 * `guards: null` and `closureLifecycle: false` together model a passthrough
 * arm — the stub still writes audit objects onto the turn record, but emits no
 * guard accounting and never runs the closure lifecycle. That combination is
 * what the coverage and resolution columns have to survive.
 */
function traceRows({
  turns = 2,
  repairedTurn = null,
  audits = TUTOR_STUB_SHOWCASE_AUDIT_KEYS,
  closedAt = null,
  guards = TUTOR_STUB_SHOWCASE_GUARD_KEYS,
  fallbackTurn = null,
  closureLifecycle = true,
} = {}) {
  const rows = [
    { type: 'run_start' },
    { type: 'model_call', role: 'tutor_stub_opening' },
    { type: 'tutor_opening', text: 'The morning list is short one name.' },
  ];
  for (let index = 1; index <= turns; index += 1) {
    rows.push({ type: 'model_call', role: 'tutor_stub_auto_learner' });
    rows.push({ type: 'model_call', role: 'tutor_stub_tutor' });
    rows.push({
      type: 'auto_learner_turn',
      text: `learner move ${index}`,
      latencyMs: 5000,
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    });
    if (repairedTurn === index)
      rows.push({ type: 'tutor_response_recovery_candidate' }, { type: 'turn_failure_recorded' });
    if (guards) {
      const outcome =
        fallbackTurn === index
          ? 'guarded_deterministic_fallback'
          : repairedTurn === index
            ? 'guarded_recovery_accepted'
            : 'guarded_original_accepted';
      rows.push({
        type: 'tutor_response_guard_accounting',
        accounting: {
          turn: index,
          outcome,
          guards: Object.fromEntries(guards.map((key) => [key, true])),
        },
      });
    }
    rows.push({
      type: 'turn_complete',
      turnRecord: {
        turn: index,
        learnerInput: `learner move ${index}`,
        tutor: `tutor reply ${index}`,
        latencyMs: 12000,
        model: 'gpt-5.6-terra',
        provider: 'codex',
        tutorResponseRepaired: repairedTurn === index,
        usage: { inputTokens: 2000, outputTokens: 300, totalTokens: 2300 },
        tutorDeterministicClosure: closedAt === index,
        closureCheckIn: false,
        ...(closureLifecycle
          ? {
              dialogueClosure: {
                lifecycle: {
                  phase: closedAt === index ? 'closed' : 'open',
                  reachedAtTurn: closedAt === index ? index : null,
                  completedAtTurn: closedAt === index ? index : null,
                  basis: closedAt === index ? 'authored_dag' : null,
                },
              },
            }
          : {}),
        ...Object.fromEntries(
          audits.map((key) => [key, { ok: !(repairedTurn === index && key === 'tutorLeakAudit'), issues: [] }]),
        ),
      },
    });
  }
  rows.push({ type: 'auto_learner_run_end', reason: closedAt ? 'grounded_closure' : 'auto_turn_cap' });
  rows.push({ type: 'closeout_report', reason: closedAt ? 'grounded_closure' : 'auto_turn_cap' });
  return rows;
}

/**
 * A whole run with the spawn and the disk read injected, so the pipeline under
 * test is the real one but nothing is spawned and nothing is paid for.
 */
async function report({ preset = 'smoke', bare = {}, instrumented = {} } = {}) {
  const traces = {
    bare: traceRows({ turns: 3, ...bare }),
    instrumented: traceRows({ turns: 4, repairedTurn: 2, closedAt: 4, ...instrumented }),
  };
  return await runTutorStubShowcase({
    plan: plan(preset),
    root: ROOT,
    spawnDialogue: async () => ({ exitCode: 0 }),
    readTrace: (traceDir) => ({
      tracePath: path.join(traceDir, 'trace.jsonl'),
      rows: traces[traceDir.includes('instrumented') ? 'instrumented' : 'bare'],
    }),
    metadata: { gitSha: 'test' },
    now: () => new Date('2026-07-26T00:00:00.000Z'),
  });
}

test('the shipped showcase config validates', () => {
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  const { arms } = validateTutorStubShowcaseConfig(loaded.config);
  assert.equal(arms.filter((arm) => arm.baseline).length, 1);
  assert.ok(arms.length >= 2);
});

test('the baseline arm is passthrough, which is the only genuinely bare mode', () => {
  // Dropping --dag/--classifier is not enough: the guard suite, first-draft
  // recovery and the closure lifecycle all run unconditionally otherwise, so a
  // baseline built that way is instrumented in every respect that matters.
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  const { arms } = validateTutorStubShowcaseConfig(loaded.config);
  const baseline = arms.find((arm) => arm.baseline);
  assert.ok(baseline.flags.includes('--passthrough'), 'baseline arm must run the stub in passthrough mode');
  for (const arm of arms.filter((candidate) => !candidate.baseline)) {
    assert.ok(!arm.flags.includes('--passthrough'));
  }
});

test('a config with the wrong schema is rejected', () => {
  assert.throws(() => validateTutorStubShowcaseConfig({ schema: 'other' }), /schema must be/u);
});

test('an arm may not carry a flag outside the declared tutor-side set', () => {
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  loaded.config.arms.bare.flags = ['--auto-learner-profile', 'confused'];
  assert.throws(() => validateTutorStubShowcaseConfig(loaded.config), /would break learner parity/u);
});

test('exactly one arm may be the baseline', () => {
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  loaded.config.arms.instrumented.baseline = true;
  assert.throws(() => validateTutorStubShowcaseConfig(loaded.config), /exactly one arm/u);
});

test('every declared arm flag is either a bare switch or takes exactly one value', () => {
  for (const flag of TUTOR_STUB_SHOWCASE_ARM_FLAGS) assert.match(flag, /^--[a-z0-9-]+$/u);
});

test('the plan spans scenarios x arms x models and keeps its child commands', () => {
  const built = plan('default');
  assert.equal(built.plannedDialogues, 4);
  assert.equal(built.status, 'ready');
  for (const job of built.jobs) {
    assert.ok(job.childArgs.includes('--auto-learner'));
    assert.ok(job.childArgs.includes('--lab'));
    assert.ok(job.childArgs.includes('--model-call-budget'));
  }
});

test('the shipped arms hold learner parity in every cell', () => {
  for (const preset of ['smoke', 'default', 'cross_model']) {
    assert.equal(assertTutorStubShowcaseLearnerParity(plan(preset).jobs), true);
  }
});

test('a learner difference between arms fails the plan rather than the reading', () => {
  const jobs = [
    { scenarioId: 's', modelId: 'm', armId: 'bare', childArgs: ['--auto-learner-profile', 'diligent', '--no-dag'] },
    {
      scenarioId: 's',
      modelId: 'm',
      armId: 'instrumented',
      childArgs: ['--auto-learner-profile', 'confused', '--dag'],
    },
  ];
  assert.throws(() => assertTutorStubShowcaseLearnerParity(jobs), /learner parity violated/u);
});

test('parity residue strips valued tutor flags and normalises the trace directory', () => {
  const residue = tutorStubShowcaseParityResidue([
    '--world',
    'world_029_riverside_clinic',
    '--dag-mode',
    'defeasible_human_scaffold',
    '--model-call-budget',
    '90',
    '--trace-dir',
    '/tmp/one',
  ]);
  assert.deepEqual(residue, ['--world', 'world_029_riverside_clinic', '--trace-dir', '<trace-dir>']);
});

test('the public plan carries the child commands so a run can be inspected before it is paid for', () => {
  const printable = publicTutorStubShowcasePlan(plan('smoke'));
  assert.equal(printable.jobs.length, 2);
  assert.ok(printable.jobs.every((job) => job.childArgs.length > 0));
  assert.equal(printable.learner.profile, 'diligent');
});

test('a plan over budget is refused before anything spawns', async () => {
  const built = plan('default', { maxDialogues: 2 });
  assert.equal(built.status, 'budget_exhausted');
  const result = await runTutorStubShowcase({
    plan: built,
    root: ROOT,
    spawnDialogue: async () => assert.fail('must not spawn when the budget is exhausted'),
  });
  assert.equal(result.status, 'budget_exhausted');
  assert.deepEqual(result.results, []);
});

test('the trace parser recovers the dialogue, the guards, and the recovery attempts', () => {
  const parsed = parseTutorStubShowcaseTrace(traceRows({ turns: 3, repairedTurn: 2, closedAt: 3 }));
  assert.equal(parsed.turnCount, 3);
  assert.equal(parsed.openingText, 'The morning list is short one name.');
  assert.equal(parsed.turns[1].tutor.repaired, true);
  assert.equal(parsed.recoveryAttempts, 1);
  assert.equal(parsed.auditsRecorded, 3 * TUTOR_STUB_SHOWCASE_AUDIT_KEYS.length);
  assert.equal(parsed.auditsFailed, 1);
  assert.equal(parsed.guardedTurns, 3);
  assert.equal(parsed.guardCoverage, 1);
  assert.equal(parsed.modelCalls, 7);
  assert.equal(parsed.callsByRole.tutor_stub_tutor, 3);
  assert.equal(parsed.usage.totalTokens, 3 * (120 + 2300));
});

test('guard coverage is read from the accounting rows, not from the audit records', () => {
  // The stub attaches an audit object to the turn record whether or not the
  // guard was enabled, so counting records would report full coverage for an
  // arm that ran no guards at all. Coverage has to come from the accounting.
  const parsed = parseTutorStubShowcaseTrace(traceRows({ turns: 2, guards: null }));
  assert.equal(parsed.auditsRecorded, 2 * TUTOR_STUB_SHOWCASE_AUDIT_KEYS.length);
  assert.equal(parsed.guardedTurns, 0);
  assert.equal(parsed.guardsEnabled, 0);
  assert.equal(parsed.guardCoverage, 0);
  assert.deepEqual(parsed.guardOutcomes, { accepted: 0, repaired: 0, fallback: 0 });
});

test('partial guard coverage is reported as a fraction of the guard slots', () => {
  const half = TUTOR_STUB_SHOWCASE_GUARD_KEYS.slice(0, 4);
  const parsed = parseTutorStubShowcaseTrace(traceRows({ turns: 2, guards: half }));
  assert.equal(parsed.guardedTurns, 2);
  assert.equal(parsed.guardsEnabled, 8);
  assert.equal(parsed.guardSlots, 2 * TUTOR_STUB_SHOWCASE_GUARD_KEYS.length);
  assert.equal(parsed.guardCoverage, Number((8 / parsed.guardSlots).toFixed(3)));
});

test('a deterministic fallback is not counted as a repair', () => {
  // A fallback means the guard rejected the draft and a canned line went out —
  // a cost of the guard stack. Summing it into repairs would show a loss as a
  // win.
  assert.equal(classifyGuardOutcome('guarded_deterministic_fallback'), 'fallback');
  assert.equal(classifyGuardOutcome('guarded_original_accepted'), 'accepted');
  assert.equal(classifyGuardOutcome('unguarded_original'), 'accepted');
  assert.equal(classifyGuardOutcome('guarded_recovery_accepted'), 'repaired');
  assert.equal(classifyGuardOutcome(''), null);

  const parsed = parseTutorStubShowcaseTrace(traceRows({ turns: 3, repairedTurn: 2, fallbackTurn: 3 }));
  assert.deepEqual(parsed.guardOutcomes, { accepted: 1, repaired: 1, fallback: 1 });

  // The recovery-attempt flag counts regenerations, including ones whose second
  // draft also failed. Observed on a real Riverside run: three turns went out as
  // deterministic fallbacks and the per-dialogue line called them three repairs.
  assert.equal(parsed.recoveryAttempts, 1);
});

test('a run killed by guard exhaustion says so instead of reporting an unknown stop', () => {
  // Every candidate rejected including the deterministic fallback: the tutor is
  // left with nothing it is allowed to say and the child dies mid-turn, so no
  // `run_end` is ever written. Falling back to `unknown` would present the most
  // consequential failure the instrumented arm has as a missing field.
  const ended = new Set(['auto_learner_run_end', 'closeout_report']);
  const rows = traceRows({ turns: 2 }).filter((row) => !ended.has(row.type));
  assert.equal(parseTutorStubShowcaseTrace(rows).stopReason, 'unknown');

  rows.push({
    type: 'tutor_response_guard_exhausted',
    accounting: { outcome: 'guard_exhausted_without_public_delivery' },
  });
  assert.equal(parseTutorStubShowcaseTrace(rows).stopReason, 'guard_exhausted');
});

test('closure is read from the stub lifecycle, not from the transcript text', () => {
  const open = parseTutorStubShowcaseTrace(traceRows({ turns: 2 }));
  assert.equal(open.closure.available, true);
  assert.equal(open.closure.grounded, false);
  assert.equal(open.stopReason, 'auto_turn_cap');
  const closed = parseTutorStubShowcaseTrace(traceRows({ turns: 2, closedAt: 2 }));
  assert.equal(closed.closure.grounded, true);
  assert.equal(closed.closure.completedAtTurn, 2);
  assert.equal(closed.stopReason, 'grounded_closure');
});

test('an arm that bypasses the closure lifecycle has no verdict rather than a negative one', () => {
  const parsed = parseTutorStubShowcaseTrace(traceRows({ turns: 2, guards: null, closureLifecycle: false }));
  assert.equal(parsed.closure.available, false);
  assert.equal(parsed.closure.grounded, null);
  assert.equal(parsed.closure.completedAtTurn, null);
});

test('a bypassed arm is excluded from the resolution denominator, not scored zero', async () => {
  const built = await report({ bare: { guards: null, closureLifecycle: false } });
  const bare = built.summary.arms.find((arm) => arm.id === 'bare');
  const instrumented = built.summary.arms.find((arm) => arm.id === 'instrumented');
  assert.equal(bare.dialogues, 1);
  assert.equal(bare.closureMeasurable, 0);
  assert.equal(bare.groundedRate, null);
  assert.equal(instrumented.closureMeasurable, 1);
  assert.equal(instrumented.groundedRate, 1);
});

test('a full run summarises both arms without spawning anything', async () => {
  const built = await report();
  assert.equal(built.status, 'complete');
  assert.equal(built.results.length, 2);
  const bare = built.summary.arms.find((arm) => arm.id === 'bare');
  const instrumented = built.summary.arms.find((arm) => arm.id === 'instrumented');
  assert.equal(bare.baseline, true);
  assert.equal(bare.grounded, 0);
  assert.equal(instrumented.grounded, 1);
  assert.equal(instrumented.recoveryAttempts, 1);
  assert.equal(instrumented.meanTurns, 4);
});

test('a spawn failure blocks that model instead of retrying it', async () => {
  const built = plan('default');
  const result = await runTutorStubShowcase({
    plan: built,
    root: ROOT,
    spawnDialogue: async () => {
      throw new Error('cli bridge unavailable');
    },
    metadata: {},
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.results.filter((row) => row.status === 'blocked').length, built.plannedDialogues);
  assert.match(result.results[1].error.message, /model blocked by earlier dialogue/u);
});

test('the summary of an empty run is well formed', () => {
  const summary = summarizeTutorStubShowcase({ plan: plan('smoke'), results: [] });
  assert.equal(summary.completed, 0);
  assert.equal(summary.arms.length, 2);
  assert.equal(summary.arms[0].groundedRate, null);
});

test('the markdown report states that the arms are not a controlled contrast', async () => {
  const markdown = renderTutorStubShowcaseMarkdown(await report());
  assert.match(markdown, /attributable to\s+instrumentation alone/u);
  assert.match(markdown, /Guard coverage is the share of the eight per-turn guards/u);
  assert.match(markdown, /summing them would let a fallback read as a repair/u);
  assert.match(markdown, /Instrumented tutor/u);
});

test('the html surface renders both arms, the repair, and the standing caveat', async () => {
  const html = renderTutorStubShowcaseHtml(await report());
  assert.match(html, /Tutor instrumentation showcase/u);
  assert.match(html, /Bare tutor/u);
  assert.match(html, /Instrumented tutor/u);
  assert.match(html, /first draft repaired/u);
  assert.match(html, /resolved at turn 4/u);
  assert.match(html, /not evidence about human learning/u);
  assert.ok(!/<script src=/u.test(html), 'the surface must stay self-contained');
});

/**
 * Scoring is a later pass than rendering, so the page must be complete without
 * it. These two tests pin both halves of that: no overlay renders exactly the
 * cost-and-conduct page, and an overlay adds scores in both places a reader
 * looks — the headline table and each scenario's column heads.
 */
test('an unscored page carries no score columns and claims nothing about quality', async () => {
  // The stylesheet always names the score classes; only the markup is conditional.
  const html = renderTutorStubShowcaseHtml(await report());
  assert.ok(!/<th class="sc-num sc-th-score">/u.test(html), 'the benchmark table gains score columns only with data');
  assert.ok(!/class="sc-head-scores"/u.test(html), 'a column head gains scores only with data');
  assert.ok(!/Rubric scoring/u.test(html), 'the scoring section is absent, not empty');
});

test('a scored page carries per-arm scores in the benchmark table and in every column head', async () => {
  const built = await report();
  const rows = built.results.filter((result) => result.dialogue);
  const overlay = buildShowcaseScoreOverlay({
    prBenchmark: {
      rubric: { version: '1.0' },
      judge: 'claude-code.sonnet',
      axesAsked: [{ axisId: 'safety' }],
      axesUnavailable: [{ axisId: 'overall_delivery', reason: 'no case criterion in a free-running dialogue' }],
      rows: rows.map((result) => ({
        dialogueId: result.id,
        scenarioId: result.scenarioId,
        armId: result.armId,
        baseline: Boolean(result.baseline),
        turnIndex: 1,
        success: true,
        axes: { safety: { label: 'pass' } },
        transferableVerdict: 'pass',
      })),
    },
    tutorV22: {
      rubricVersion: '2.2',
      judge: 'claude-code.sonnet',
      turns: 'first-last',
      rows: rows.map((result, index) => ({
        dialogueId: result.id,
        scenarioId: result.scenarioId,
        armId: result.armId,
        baseline: Boolean(result.baseline),
        turnIndex: 1,
        turnLabel: 'first',
        success: true,
        overallScore: 40 + index,
      })),
    },
  });

  const html = renderTutorStubShowcaseHtml(built, { overlay });
  assert.match(html, /<th class="sc-num sc-th-score">Rubric first<\/th>/u);
  assert.match(html, /<th class="sc-num sc-th-score">Labels<\/th>/u);
  // Nothing was scored as a last turn, so the last-turn cell must say so rather
  // than fall back to the first-turn number or to zero.
  assert.match(html, /Rubric last/u);
  assert.equal(
    (html.match(/class="sc-head-scores"/gu) || []).length,
    rows.length,
    'every arm column in every scenario carries its own scores',
  );
  assert.match(html, /nothing here averages across them/u);
});

test('two rubric versions render as two labelled blocks and are never merged into one reading', async () => {
  const built = await report();
  const rows = built.results.filter((result) => result.dialogue);
  const tutorRows = (score) =>
    rows.map((result, index) => ({
      dialogueId: result.id,
      scenarioId: result.scenarioId,
      armId: result.armId,
      baseline: Boolean(result.baseline),
      turnIndex: 1,
      turnLabel: 'first',
      success: true,
      overallScore: score + index,
    }));
  const overlay = buildShowcaseScoreOverlay({
    prBenchmark: {
      rubric: { version: '1.0' },
      judge: 'claude-code.sonnet',
      axesAsked: [{ axisId: 'safety' }],
      axesUnavailable: [{ axisId: 'overall_delivery', reason: 'no case criterion in a free-running dialogue' }],
      rows: tutorRows(0).map((row) => ({ ...row, axes: { safety: { label: 'pass' } }, transferableVerdict: 'pass' })),
    },
    tutorV22: { rubricVersion: '2.2', judge: 'claude-code.sonnet', turns: 'first-last', rows: tutorRows(40) },
    tutorV30: { rubricVersion: '3.0', judge: 'claude-code.sonnet', turns: 'first-last', rows: tutorRows(80) },
  });

  const html = renderTutorStubShowcaseHtml(built, { overlay });
  assert.match(html, /Tutor rubric — v2\.2/u);
  assert.match(html, /Tutor rubric — v3\.0/u);
  assert.match(html, /not comparable with the v2\.2 numbers/u);
  // The count is derived, not hardcoded: three artefacts must announce three.
  assert.match(html, /Three instruments, kept apart/u);

  // The headline table stays on v2.2 alone: a second version sharing that column
  // pair would read as one measure rather than two instruments.
  assert.equal((html.match(/sc-th-score">Rubric first</gu) || []).length, 1);
  assert.match(html, /A v3\.0 pass was also run/u);

  // Both versions reach the per-turn grain and the per-scenario grain, so a
  // column head cannot disagree with the turns beneath it about what ran.
  assert.match(html, /tutor v3\.0/u);
  assert.equal((html.match(/sc-score-tag">v3\.0</gu) || []).length, rows.length);
});

test('a page scored under v3.0 alone still reports it rather than rendering unscored', async () => {
  const built = await report();
  const rows = built.results.filter((result) => result.dialogue);
  const overlay = buildShowcaseScoreOverlay({
    tutorV30: {
      rubricVersion: '3.0',
      judge: 'claude-code.sonnet',
      turns: 'first-last',
      rows: rows.map((result) => ({
        dialogueId: result.id,
        scenarioId: result.scenarioId,
        armId: result.armId,
        baseline: Boolean(result.baseline),
        turnIndex: 1,
        turnLabel: 'first',
        success: true,
        overallScore: 70,
      })),
    },
  });

  const html = renderTutorStubShowcaseHtml(built, { overlay });
  assert.match(html, /Tutor rubric — v3\.0/u);
  assert.match(html, /One instrument\./u);
  assert.ok(!/Tutor rubric — v2\.2/u.test(html), 'a version nobody ran must not appear');
  // Match the emitted header cell, not the bare class: `sc-th-score` also names a
  // stylesheet rule, which is present whether or not any column uses it.
  assert.equal(
    (html.match(/sc-th-score">Rubric first</gu) || []).length,
    0,
    'the headline columns are v2.2 only and v2.2 was not run',
  );
  assert.equal((html.match(/sc-th-score">Labels</gu) || []).length, 0, 'no PR-benchmark pass, so no Labels column');
});

test('the cli prints a finite plan and spends nothing', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/run-tutor-stub-showcase.js', '--print-plan', '--preset', 'smoke'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /dialogues: 2\/8/u);
  assert.match(result.stdout, /identical on every arm/u);
});

test('the config schema constant matches the shipped file', () => {
  const loaded = loadTutorStubShowcaseConfig(CONFIG_PATH);
  assert.equal(loaded.config.schema, TUTOR_STUB_SHOWCASE_CONFIG_SCHEMA);
});

/**
 * Navigation, magnification, and the instrument-contrast panel.
 *
 * The page is a single file someone opens from disk, often after being sent it,
 * so it has to carry its own way around and its own type control. The tests
 * below pin the two properties that would rot silently: that no menu entry
 * promises a section the page did not render, and that the whole document
 * remains one self-contained file.
 */
test('the jump menu offers only anchors the page actually rendered', async () => {
  const built = await report();
  const html = renderTutorStubShowcaseHtml(built);

  const hrefs = [...html.matchAll(/class="sc-nav-link" href="#([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(hrefs.length >= 3, 'expected a menu');
  for (const id of hrefs) {
    assert.ok(new RegExp(`id="${id}"`, 'u').test(html), `menu points at #${id}, which the page never renders`);
  }
  // Every transcript section is reachable, not just the first.
  const scenarioIds = [...new Set(built.results.filter((row) => row.dialogue).map((row) => row.scenarioId))];
  assert.equal(
    hrefs.filter((id) => id.startsWith('sc-scenario-')).length,
    scenarioIds.length,
    'every scenario needs its own menu entry',
  );
});

/**
 * A scored overlay over a built report, with enough turns for a correlation to
 * be computable at all. Two turns per dialogue — what a real showcase run scores
 * — leaves every pairwise r undefined, so the contrast panel would render half
 * its blocks and the tests would pass on an emptier page than the one shipped.
 */
function contrastOverlay(built, { v30 = false } = {}) {
  const dialogues = built.results.filter((result) => result.dialogue);
  const turnIndexes = [1, 2, 3, 4];
  const rowsFor = (score) =>
    dialogues.flatMap((result, dialogueIndex) =>
      turnIndexes.map((turnIndex) => {
        const step = dialogueIndex * turnIndexes.length + turnIndex - 1;
        return {
          dialogueId: result.id,
          scenarioId: result.scenarioId,
          armId: result.armId,
          baseline: Boolean(result.baseline),
          turnIndex,
          turnLabel: turnIndex === 1 ? 'first' : 'last',
          success: true,
          ...score(step),
        };
      }),
    );

  return buildShowcaseScoreOverlay({
    tutorV22: {
      rubricVersion: '2.2',
      judge: 'claude-code.sonnet',
      turns: 'first-last',
      rows: rowsFor((step) => ({
        overallScore: 40 + step * 4,
        scores: {
          // Two dimensions that move together and one that moves against them,
          // so the panel has both a "most alike" and a "least alike" pair.
          perception_quality: { score: 1 + step * 0.4 },
          pedagogical_craft: { score: 1 + step * 0.35 },
          elicitation_quality: { score: 5 - step * 0.4 },
        },
      })),
    },
    tutorV30: v30
      ? {
          rubricVersion: '3.0',
          judge: 'claude-code.sonnet',
          turns: 'first-last',
          rows: rowsFor((step) => ({
            overallScore: 30 + step * 6,
            scores: {
              overall_pedagogical_quality: { score: 3 + step * 0.6 },
              content_accuracy: { score: 4 },
            },
          })),
        }
      : null,
  });
}

test('the menu links to the scoring sections only when there is scoring to link to', async () => {
  const built = await report();
  const unscored = renderTutorStubShowcaseHtml(built);
  assert.ok(!/href="#sc-scoring"/u.test(unscored), 'no overlay, so no scoring entry');
  assert.ok(!/href="#sc-contrast"/u.test(unscored), 'no overlay, so no contrast entry');

  const scored = renderTutorStubShowcaseHtml(built, { overlay: contrastOverlay(built) });
  assert.match(scored, /href="#sc-scoring"/u);
  assert.match(scored, /href="#sc-contrast"/u);
  assert.match(scored, /id="sc-contrast"/u);
  assert.match(scored, /Instrument contrast/u);
});

test('the contrast panel reports discrimination and refuses to read the radar as merit', async () => {
  const built = await report();
  const html = renderTutorStubShowcaseHtml(built, { overlay: contrastOverlay(built, { v30: true }) });

  assert.match(html, /Which instrument separates the turns\?/u);
  assert.match(html, /How much does a version repeat itself\?/u);
  assert.match(html, /Where the versions part company/u);
  // A radar's area is an axis-order artefact, so the page must say so wherever it
  // draws one; a reader left to interpret the shape will read bigger as better.
  assert.match(html, /a bigger shape is not a better/u);
  // Small n is a property of this run, and the panel is required to lead with it.
  assert.match(html, /Small sample/u);
});

test('the contrast panel names the whole-transcript instrument it does not run', async () => {
  const built = await report();
  const html = renderTutorStubShowcaseHtml(built, { overlay: contrastOverlay(built) });

  // Both rubrics on this page score one turn at a time. The instrument that
  // scores a transcript as a whole exists, was tried on material like this, and
  // failed its transfer gate — which is the useful thing to report, and is more
  // useful than a score the page could have produced by ignoring the gate.
  assert.match(html, /scored one turn at a time/u);
  assert.match(html, /evaluation-rubric-poetics\.yaml/u);
  assert.match(html, /weighted κ ≈ 0\.04\s+against a pre-registered bar of 0\.60/u);
});

test('the page carries its own type control and stays a single self-contained file', async () => {
  const html = renderTutorStubShowcaseHtml(await report());

  assert.match(html, /id="sc-toggle-text"/u);
  assert.match(html, /id="sc-toggle-stack"/u);
  // Root font size drives every rem on the page, so one control resizes the whole
  // document rather than the prose alone.
  assert.match(html, /font-size: calc\(100% \* var\(--sc-scale\)\)/u);
  assert.match(html, /html\[data-sc-text='large'\]/u);
  assert.ok(!/<script src=/u.test(html), 'no external script');
  assert.ok(!/<link rel="stylesheet"/u.test(html), 'no external stylesheet');
});

test('wide tables scroll inside their own box so the page body never scrolls sideways', async () => {
  const built = await report();
  const html = renderTutorStubShowcaseHtml(built);
  const tables = (html.match(/<table class="sc-table">/gu) || []).length;
  const wrappers = (html.match(/<div class="sc-table-scroll"/gu) || []).length;
  assert.ok(tables > 0, 'expected at least one table');
  assert.equal(wrappers, tables, 'every table needs its own scroll container');
  assert.match(html, /\.sc-table-scroll \{ overflow-x: auto/u);
});

test('a collapsed transcript column still says which arm it belongs to', async () => {
  // Side by side, the two column heads label the arms. Stacked — by the nav
  // button or by a narrow viewport — the heads are gone, and without this the
  // reader gets two unlabelled walls of text.
  const html = renderTutorStubShowcaseHtml(await report());
  assert.match(html, /class="sc-cell-arm"/u);
  assert.match(html, /body\[data-sc-stack='on'\] \.sc-cell-arm \{ display: block; \}/u);
});
