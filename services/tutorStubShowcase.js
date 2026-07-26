/**
 * Free-running instrumentation showcase.
 *
 * Spawns the tutor stub twice per scenario — once bare, once fully
 * instrumented — with an automated learner on both sides, and lets each
 * dialogue run to its own end. It produces two complete, resolving transcripts
 * and a benchmark panel: calls, wall clock, guard coverage, first-draft
 * repairs, and whether the conversation actually closed.
 *
 * What this is NOT: a controlled comparison. Each arm has its own learner
 * answering its own tutor, so the two conversations diverge after the first
 * exchange and no difference between them can be attributed to instrumentation
 * alone. The frozen A/B (`services/tutorStubAbHarness.js`) is the instrument
 * that holds the dialogue fixed; this one shows what the system does when it is
 * allowed to run. They answer different questions and are meant to be read
 * together.
 *
 * The one thing held constant here is the learner configuration. Both arms get
 * the same world, learner model, learner profile, turn cap, and streaming
 * settings, and `assertTutorStubShowcaseLearnerParity` refuses to run a plan
 * whose arms differ anywhere outside the declared tutor-side flag set. Without
 * it a "bare" arm could quietly be handed an easier learner and the demo would
 * be showing the learner, not the tutor.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

export const TUTOR_STUB_SHOWCASE_CONFIG_SCHEMA = 'machinespirits.tutor-stub.showcase-config.v1';
export const TUTOR_STUB_SHOWCASE_PLAN_SCHEMA = 'machinespirits.tutor-stub.showcase-plan.v1';
export const TUTOR_STUB_SHOWCASE_REPORT_SCHEMA = 'machinespirits.tutor-stub.showcase-report.v1';

const MODEL_PROVIDERS = new Set(['codex', 'claude-code']);

/**
 * The only flags an arm may vary. Everything else in the child command is
 * fixed by the plan builder, which is what makes the two transcripts
 * comparable as demonstrations even though they are not a controlled contrast.
 *
 * `--model-call-budget` is here because the instrumented arm genuinely needs a
 * higher ceiling; a run records whether either arm's budget actually bound, so
 * a truncated dialogue can never be mistaken for a finished one.
 */
export const TUTOR_STUB_SHOWCASE_ARM_FLAGS = Object.freeze([
  '--dag',
  '--no-dag',
  '--dag-mode',
  '--tutor-learner-dag',
  '--no-tutor-learner-dag',
  '--classifier',
  '--no-classifier',
  '--memory-summary',
  '--no-memory-summary',
  '--committee',
  '--no-committee',
  '--model-call-budget',
]);

const ARM_FLAG_SET = new Set(TUTOR_STUB_SHOWCASE_ARM_FLAGS);
const VALUED_ARM_FLAGS = new Set(['--dag-mode', '--model-call-budget']);

/**
 * Per-turn audits the stub emits on its turn record. Presence means the audit
 * ran; absence means nothing checked that dimension on that turn. A bare arm
 * passes some of these by never being asked, which is why the report counts
 * coverage separately from pass rate.
 */
export const TUTOR_STUB_SHOWCASE_AUDIT_KEYS = Object.freeze([
  'tutorLeakAudit',
  'tutorQuestionSupportAudit',
  'tutorDramaticReleaseAudit',
  'tutorHumanScaffoldAudit',
  'tutorRepetitionAudit',
  'tutorDialogueClosureAudit',
  'tutorLiveSourceActionAlignmentAudit',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function positiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

export function loadTutorStubShowcaseConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8');
  return { config: yaml.parse(source), source, configSha256: sha256(source), configPath: path.resolve(configPath) };
}

function resolveArm(id, definition) {
  const flags = (definition?.flags || []).map(String);
  for (let index = 0; index < flags.length; index += 1) {
    const token = flags[index];
    if (!token.startsWith('--')) continue;
    if (!ARM_FLAG_SET.has(token)) {
      throw new Error(`arm ${id} flag ${token} is not a declared tutor-side flag; it would break learner parity`);
    }
    if (VALUED_ARM_FLAGS.has(token)) index += 1;
  }
  return {
    id,
    label: String(definition?.label || id),
    summary: String(definition?.summary || ''),
    baseline: definition?.baseline === true,
    flags,
    modelCallBudget: positiveInt(definition?.model_call_budget, `arm ${id}.model_call_budget`),
  };
}

export function validateTutorStubShowcaseConfig(config) {
  if (!config || config.schema !== TUTOR_STUB_SHOWCASE_CONFIG_SCHEMA) {
    throw new Error(`showcase config schema must be ${TUTOR_STUB_SHOWCASE_CONFIG_SCHEMA}`);
  }
  for (const key of ['models', 'arms', 'scenarios', 'presets', 'learner']) {
    if (!config[key]) throw new Error(`showcase config requires ${key}`);
  }
  for (const [id, model] of Object.entries(config.models)) {
    if (!MODEL_PROVIDERS.has(model?.provider)) throw new Error(`model ${id} must use codex or claude-code`);
    if (!String(model.model || '').trim()) throw new Error(`model ${id} requires model`);
  }
  const arms = Object.entries(config.arms).map(([id, definition]) => resolveArm(id, definition));
  const baselines = arms.filter((arm) => arm.baseline);
  if (baselines.length !== 1) throw new Error('exactly one arm must be marked baseline: true');
  for (const [id, scenario] of Object.entries(config.scenarios)) {
    if (!String(scenario?.world || '').trim()) throw new Error(`scenario ${id} requires world`);
    positiveInt(scenario.max_turns, `scenario ${id}.max_turns`);
    positiveInt(scenario.safety_turns, `scenario ${id}.safety_turns`);
    if (scenario.safety_turns < scenario.max_turns) {
      throw new Error(`scenario ${id}.safety_turns must not be below max_turns`);
    }
  }
  if (!config.models[config.learner?.model]) throw new Error('learner.model must name a configured model');
  if (!String(config.learner?.profile || '').trim()) throw new Error('learner.profile is required');
  for (const [id, preset] of Object.entries(config.presets)) {
    for (const key of ['models', 'arms', 'scenarios']) {
      const list = preset?.[key];
      if (!Array.isArray(list) || !list.length) throw new Error(`preset ${id}.${key} must be a non-empty list`);
      for (const entry of list) {
        if (!config[key][entry]) throw new Error(`preset ${id} references unknown ${key.slice(0, -1)} ${entry}`);
      }
    }
  }
  positiveInt(config.budgets?.max_dialogues, 'budgets.max_dialogues');
  if (config.budgets?.concurrency !== 1) throw new Error('budgets.concurrency must remain 1');
  if (config.budgets?.retries_per_job !== 0) throw new Error('budgets.retries_per_job must remain 0');
  return { config, arms };
}

/**
 * Build the child command. The tutor-side flags come last so an arm's
 * `--dag`/`--no-dag` wins over anything the shared prefix implies, and so the
 * parity residue below is a clean prefix.
 */
export function tutorStubShowcaseChildArgs({ arm, scenario, model, learner, traceDir }) {
  const shared = [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--auto-learner',
    '--auto-turns',
    String(scenario.maxTurns),
    '--auto-safety-turns',
    String(scenario.safetyTurns),
    '--world',
    scenario.world,
    '--model',
    `${model.provider}.${model.model}`,
    '--auto-learner-model',
    `${learner.provider}.${learner.model}`,
    '--auto-learner-profile',
    learner.profile,
    '--cli-effort',
    String(model.effort || 'medium'),
    '--no-stream',
    '--no-interim-animation',
    '--no-remember-settings',
    '--trace-dir',
    traceDir,
  ];
  return [...shared, ...arm.flags, '--model-call-budget', String(arm.modelCallBudget)];
}

/**
 * Strip every declared tutor-side flag (and its value). What remains is the
 * learner-and-world configuration, which must be identical across the arms of
 * one scenario. The trace directory differs by arm, so it is normalised out.
 */
export function tutorStubShowcaseParityResidue(childArgs) {
  const residue = [];
  for (let index = 0; index < childArgs.length; index += 1) {
    const token = childArgs[index];
    if (ARM_FLAG_SET.has(token)) {
      if (VALUED_ARM_FLAGS.has(token)) index += 1;
      continue;
    }
    if (token === '--trace-dir') {
      residue.push(token, '<trace-dir>');
      index += 1;
      continue;
    }
    residue.push(token);
  }
  return residue;
}

export function assertTutorStubShowcaseLearnerParity(jobs) {
  const byCell = new Map();
  for (const job of jobs) {
    const key = `${job.scenarioId}__${job.modelId}`;
    const residue = tutorStubShowcaseParityResidue(job.childArgs).join(' ');
    if (!byCell.has(key)) byCell.set(key, { armId: job.armId, residue });
    else if (byCell.get(key).residue !== residue) {
      throw new Error(
        `learner parity violated for ${key}: arms ${byCell.get(key).armId} and ${job.armId} differ outside the declared tutor-side flags`,
      );
    }
  }
  return true;
}

export function buildTutorStubShowcasePlan({
  config,
  preset = 'default',
  arms = null,
  scenarios = null,
  models = null,
  maxTurns = null,
  maxDialogues = null,
  traceRoot = '.tutor-stub-traces/showcase',
  configSha256 = null,
} = {}) {
  const { config: validated, arms: allArms } = validateTutorStubShowcaseConfig(config);
  const selectedPreset = validated.presets[preset];
  if (!selectedPreset) throw new Error(`unknown showcase preset ${preset}`);
  const armIds = [...new Set((arms || selectedPreset.arms).map(String))];
  const scenarioIds = [...new Set((scenarios || selectedPreset.scenarios).map(String))];
  const modelIds = [...new Set((models || selectedPreset.models).map(String))];
  for (const id of armIds) if (!validated.arms[id]) throw new Error(`unknown selected arm ${id}`);
  for (const id of scenarioIds) if (!validated.scenarios[id]) throw new Error(`unknown selected scenario ${id}`);
  for (const id of modelIds) if (!validated.models[id]) throw new Error(`unknown selected model ${id}`);

  const resolvedArms = armIds.map((id) => allArms.find((entry) => entry.id === id));
  const baselineArm = resolvedArms.find((arm) => arm.baseline);
  if (!baselineArm) throw new Error('selected arms must include the baseline arm');

  const learnerModel = validated.models[validated.learner.model];
  const learner = {
    profile: String(validated.learner.profile),
    modelId: validated.learner.model,
    provider: learnerModel.provider,
    model: learnerModel.model,
  };

  const jobs = [];
  for (const scenarioId of scenarioIds) {
    const definition = validated.scenarios[scenarioId];
    const scenario = {
      id: scenarioId,
      label: String(definition.label || scenarioId),
      summary: String(definition.summary || ''),
      world: String(definition.world),
      maxTurns: maxTurns === null ? definition.max_turns : positiveInt(maxTurns, 'maxTurns'),
      safetyTurns: maxTurns === null ? definition.safety_turns : positiveInt(maxTurns, 'maxTurns') + 4,
    };
    for (const modelId of modelIds) {
      for (const arm of resolvedArms) {
        const id = `${scenarioId}__${arm.id}__${modelId}`;
        jobs.push({
          id,
          scenarioId,
          scenario: clone(scenario),
          armId: arm.id,
          arm: clone(arm),
          modelId,
          model: clone(validated.models[modelId]),
          learner: clone(learner),
          traceDir: path.join(traceRoot, id),
          childArgs: tutorStubShowcaseChildArgs({
            arm,
            scenario,
            model: validated.models[modelId],
            learner,
            traceDir: path.join(traceRoot, id),
          }),
        });
      }
    }
  }
  assertTutorStubShowcaseLearnerParity(jobs);

  const dialogueBudget =
    maxDialogues === null ? validated.budgets.max_dialogues : positiveInt(maxDialogues, 'maxDialogues');
  return {
    schema: TUTOR_STUB_SHOWCASE_PLAN_SCHEMA,
    preset,
    armIds,
    scenarioIds,
    modelIds,
    baselineArmId: baselineArm.id,
    arms: resolvedArms.map(clone),
    learner,
    jobs,
    plannedDialogues: jobs.length,
    maxDialogues: dialogueBudget,
    turnTimeoutMs: validated.budgets.turn_timeout_ms || 1800000,
    status: jobs.length > dialogueBudget ? 'budget_exhausted' : 'ready',
    configSha256,
  };
}

export function publicTutorStubShowcasePlan(plan) {
  return {
    schema: plan.schema,
    preset: plan.preset,
    status: plan.status,
    plannedDialogues: plan.plannedDialogues,
    maxDialogues: plan.maxDialogues,
    baselineArmId: plan.baselineArmId,
    configSha256: plan.configSha256,
    learner: clone(plan.learner),
    arms: plan.arms.map((arm) => ({
      id: arm.id,
      label: arm.label,
      summary: arm.summary,
      baseline: arm.baseline,
      flags: [...arm.flags],
      modelCallBudget: arm.modelCallBudget,
    })),
    jobs: plan.jobs.map((job) => ({
      id: job.id,
      scenarioId: job.scenarioId,
      scenarioLabel: job.scenario.label,
      world: job.scenario.world,
      maxTurns: job.scenario.maxTurns,
      armId: job.armId,
      modelId: job.modelId,
      childArgs: [...job.childArgs],
    })),
  };
}

function auditRows(turnRecord) {
  return TUTOR_STUB_SHOWCASE_AUDIT_KEYS.filter((key) => turnRecord?.[key]).map((key) => {
    const audit = turnRecord[key];
    return {
      key,
      ok: audit.ok !== false,
      issues: (audit.issues || []).map((issue) => (typeof issue === 'string' ? issue : issue?.code || 'issue')),
    };
  });
}

/**
 * Trace rows -> a readable dialogue plus the numbers the benchmark panel needs.
 * Pure, so the tests exercise it on recorded fixtures without spawning
 * anything or spending a call.
 */
export function parseTutorStubShowcaseTrace(rows) {
  const byType = (type) => rows.filter((row) => row.type === type);
  const opening = byType('tutor_opening')[0] || null;
  const learnerTurns = byType('auto_learner_turn');
  const completions = byType('turn_complete');
  const modelCalls = byType('model_call');
  const runEnd = byType('auto_learner_run_end')[0] || null;
  const closeout = byType('closeout_report')[0] || null;

  const turns = completions.map((row, index) => {
    const record = row.turnRecord || {};
    const learnerRow = learnerTurns[index] || null;
    return {
      index: Number(record.turn ?? index + 1),
      learner: {
        text: String(learnerRow?.text || record.learnerInput || ''),
        latencyMs: Number(learnerRow?.latencyMs || 0) || null,
        usage: learnerRow?.usage || null,
      },
      tutor: {
        text: String(record.tutor || ''),
        latencyMs: Number(record.latencyMs || 0) || null,
        model: record.model || null,
        provider: record.provider || null,
        repaired: record.tutorResponseRepaired === true,
        usage: record.usage || null,
        audits: auditRows(record),
      },
      closure: {
        phase: record.dialogueClosure?.lifecycle?.phase || record.dialogueClosure?.frame?.phase || null,
        deterministic: record.tutorDeterministicClosure === true,
        checkIn: record.closureCheckIn === true,
      },
    };
  });

  const lastClosure = completions.at(-1)?.turnRecord?.dialogueClosure?.lifecycle || null;
  const callsByRole = new Map();
  for (const call of modelCalls) {
    const role = String(call.role || call.purpose || 'unknown');
    callsByRole.set(role, (callsByRole.get(role) || 0) + 1);
  }
  const usageTotals = turns.reduce(
    (totals, turn) => {
      for (const usage of [turn.learner.usage, turn.tutor.usage]) {
        if (!usage) continue;
        totals.inputTokens += Number(usage.inputTokens || 0);
        totals.outputTokens += Number(usage.outputTokens || 0);
        totals.totalTokens += Number(usage.totalTokens || 0);
      }
      return totals;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  );

  const auditsRun = turns.reduce((total, turn) => total + turn.tutor.audits.length, 0);
  const auditsFailed = turns.reduce((total, turn) => total + turn.tutor.audits.filter((audit) => !audit.ok).length, 0);

  return {
    openingText: String(opening?.text || ''),
    turns,
    turnCount: turns.length,
    repairs: turns.filter((turn) => turn.tutor.repaired).length,
    auditsRun,
    auditsFailed,
    auditCoverage: turns.length
      ? Number((auditsRun / (turns.length * TUTOR_STUB_SHOWCASE_AUDIT_KEYS.length)).toFixed(3))
      : null,
    turnFailuresRecorded: byType('turn_failure_recorded').length,
    recoveryCandidates: byType('tutor_response_recovery_candidate').length,
    modelCalls: modelCalls.length,
    callsByRole: Object.fromEntries([...callsByRole.entries()].sort(([left], [right]) => left.localeCompare(right))),
    usage: usageTotals,
    stopReason: String(runEnd?.reason || closeout?.reason || 'unknown'),
    // `grounded` is the stub's own lifecycle verdict, not a reading of the
    // text: the dialogue reached its authored answer and closed on it.
    closure: {
      phase: lastClosure?.phase || null,
      reachedAtTurn: lastClosure?.reachedAtTurn ?? null,
      completedAtTurn: lastClosure?.completedAtTurn ?? null,
      basis: lastClosure?.basis || null,
      grounded: lastClosure?.completedAtTurn !== null && lastClosure?.completedAtTurn !== undefined,
    },
    budgetBinding: rows.some((row) => row.type === 'model_call_budget_exhausted'),
  };
}

export function readTutorStubShowcaseTrace(traceDir) {
  const entries = fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .sort();
  if (!entries.length) throw new Error(`no trace written to ${traceDir}`);
  const target = path.join(traceDir, entries.at(-1));
  const rows = fs
    .readFileSync(target, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { tracePath: target, rows };
}

function errorRecord(error) {
  return { name: error?.name || 'Error', code: error?.code || null, message: String(error?.message || error) };
}

export async function runTutorStubShowcase({
  plan,
  root,
  spawnDialogue,
  readTrace = readTutorStubShowcaseTrace,
  metadata = {},
  onProgress = null,
  now = () => new Date(),
} = {}) {
  const startedAt = now().toISOString();
  if (plan.status === 'budget_exhausted') {
    return {
      schema: TUTOR_STUB_SHOWCASE_REPORT_SCHEMA,
      status: 'budget_exhausted',
      startedAt,
      completedAt: now().toISOString(),
      metadata,
      plan: publicTutorStubShowcasePlan(plan),
      results: [],
      summary: summarizeTutorStubShowcase({ plan, results: [] }),
    };
  }
  const results = [];
  const blockedModels = new Map();
  for (const job of plan.jobs) {
    if (blockedModels.has(job.modelId)) {
      results.push({
        id: job.id,
        scenarioId: job.scenarioId,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        error: { ...blockedModels.get(job.modelId), message: `model blocked by earlier dialogue: ${job.modelId}` },
      });
      continue;
    }
    const started = Date.now();
    try {
      const spawned = await spawnDialogue({ job, root, timeoutMs: plan.turnTimeoutMs });
      const trace = readTrace(path.resolve(root, job.traceDir));
      const dialogue = parseTutorStubShowcaseTrace(trace.rows);
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        scenarioLabel: job.scenario.label,
        scenarioSummary: job.scenario.summary,
        world: job.scenario.world,
        armId: job.armId,
        armLabel: job.arm.label,
        armSummary: job.arm.summary,
        baseline: job.arm.baseline,
        flags: [...job.arm.flags],
        modelId: job.modelId,
        provider: job.model.provider,
        model: job.model.model,
        status: spawned?.exitCode === 0 ? 'complete' : 'failed',
        exitCode: spawned?.exitCode ?? null,
        wallClockMs: Date.now() - started,
        tracePath: path.relative(root, trace.tracePath),
        dialogue,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    } catch (error) {
      const recorded = errorRecord(error);
      blockedModels.set(job.modelId, recorded);
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        wallClockMs: Date.now() - started,
        error: recorded,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    }
  }
  const blocked = results.filter((row) => row.status === 'blocked').length;
  const failed = results.filter((row) => row.status === 'failed').length;
  return {
    schema: TUTOR_STUB_SHOWCASE_REPORT_SCHEMA,
    status: blocked ? 'blocked' : failed ? 'incomplete' : 'complete',
    startedAt,
    completedAt: now().toISOString(),
    metadata,
    plan: publicTutorStubShowcasePlan(plan),
    results,
    summary: summarizeTutorStubShowcase({ plan, results }),
  };
}

function mean(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function summarizeTutorStubShowcase({ plan, results }) {
  const arms = plan.armIds.map((armId) => {
    const rows = results.filter((row) => row.armId === armId && row.dialogue);
    const armPlan = plan.arms.find((entry) => entry.id === armId);
    const grounded = rows.filter((row) => row.dialogue.closure.grounded).length;
    return {
      id: armId,
      label: armPlan?.label || armId,
      baseline: armId === plan.baselineArmId,
      flags: armPlan ? [...armPlan.flags] : [],
      dialogues: rows.length,
      blocked: results.filter((row) => row.armId === armId && row.status === 'blocked').length,
      // Did it resolve? This is the stub's own closure lifecycle, not a reading
      // of the transcript, so it is the same question asked of both arms.
      grounded,
      groundedRate: rows.length ? Number((grounded / rows.length).toFixed(2)) : null,
      meanTurns: mean(rows.map((row) => row.dialogue.turnCount)),
      totalModelCalls: rows.reduce((total, row) => total + row.dialogue.modelCalls, 0),
      meanModelCalls: mean(rows.map((row) => row.dialogue.modelCalls)),
      meanWallClockMs: mean(rows.map((row) => row.wallClockMs)),
      meanSecondsPerTurn: rows.length
        ? Number(
            (
              rows.reduce((total, row) => total + row.wallClockMs / Math.max(1, row.dialogue.turnCount), 0) /
              rows.length /
              1000
            ).toFixed(1),
          )
        : null,
      totalTokens: rows.reduce((total, row) => total + row.dialogue.usage.totalTokens, 0),
      repairs: rows.reduce((total, row) => total + row.dialogue.repairs, 0),
      auditsRun: rows.reduce((total, row) => total + row.dialogue.auditsRun, 0),
      auditsFailed: rows.reduce((total, row) => total + row.dialogue.auditsFailed, 0),
      meanAuditCoverage: rows.length
        ? Number((rows.reduce((total, row) => total + (row.dialogue.auditCoverage || 0), 0) / rows.length).toFixed(2))
        : null,
      budgetBinding: rows.filter((row) => row.dialogue.budgetBinding).length,
      stopReasons: [...new Set(rows.map((row) => row.dialogue.stopReason))],
    };
  });
  return {
    baselineArmId: plan.baselineArmId,
    totalDialogues: plan.plannedDialogues,
    completed: results.filter((row) => row.status === 'complete').length,
    blocked: results.filter((row) => row.status === 'blocked').length,
    arms,
  };
}

export function renderTutorStubShowcaseMarkdown(report) {
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  const lines = [
    '# Tutor instrumentation showcase',
    '',
    `- Status: **${report.status}**`,
    `- Preset: \`${report.plan.preset}\``,
    `- Learner: \`${report.plan.learner.provider}.${report.plan.learner.model}\` profile \`${report.plan.learner.profile}\` (identical on every arm)`,
    `- Commit: \`${report.metadata?.gitSha || 'unknown'}\``,
    '',
    'Two free-running dialogues per scenario. Each arm has its own learner answering',
    'its own tutor, so the transcripts diverge after the first exchange and no',
    'difference below is attributable to instrumentation alone. For the controlled',
    'contrast see the frozen A/B (`npm run tutor:stub:ab`).',
    '',
    '## Arms',
    '',
    '| Arm | Dialogues | Resolved | Turns | Calls | s/turn | Tokens | Guards run | Guard fails | Repairs |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const arm of report.summary.arms) {
    lines.push(
      `| ${cell(arm.label)}${arm.baseline ? ' _(baseline)_' : ''} | ${arm.dialogues} | ${arm.grounded}/${arm.dialogues} | ${arm.meanTurns ?? '—'} | ${arm.meanModelCalls ?? '—'} | ${arm.meanSecondsPerTurn ?? '—'} | ${arm.totalTokens || '—'} | ${arm.auditsRun} | ${arm.auditsFailed} | ${arm.repairs} |`,
    );
  }
  lines.push(
    '',
    '"Guards run" is coverage, not merit: a dialogue with no guards configured cannot',
    'fail one. Read it alongside "guard fails" and "repairs" — a repair is a first',
    'draft that failed its guards and was regenerated before the learner saw it.',
    '',
    '## Dialogues',
    '',
  );
  for (const scenarioId of report.plan.jobs
    .map((job) => job.scenarioId)
    .filter((id, index, all) => all.indexOf(id) === index)) {
    const rows = report.results.filter((row) => row.scenarioId === scenarioId && row.dialogue);
    if (!rows.length) continue;
    lines.push(`### ${cell(rows[0].scenarioLabel)} (\`${rows[0].world}\`)`, '');
    if (rows[0].scenarioSummary) lines.push(cell(rows[0].scenarioSummary), '');
    for (const row of rows) {
      const closure = row.dialogue.closure.grounded
        ? `resolved at turn ${row.dialogue.closure.completedAtTurn}`
        : `did not resolve (stopped: ${row.dialogue.stopReason})`;
      lines.push(
        `- **${cell(row.armLabel)}** — ${row.dialogue.turnCount} turns, ${row.dialogue.modelCalls} calls, ${Math.round(row.wallClockMs / 1000)}s, ${closure}${row.dialogue.repairs ? `, ${row.dialogue.repairs} first-draft repair(s)` : ''}`,
      );
    }
    lines.push('');
  }
  lines.push(
    'Full transcripts are in the HTML surface beside this file. Trace paths are in',
    '`report.json`; each dialogue keeps its own JSONL trace.',
    '',
  );
  return lines.join('\n');
}
