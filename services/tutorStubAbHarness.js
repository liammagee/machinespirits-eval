/**
 * Instrumentation A/B harness.
 *
 * Runs the same frozen dialogue past two or more instrumentation arms and
 * grades every candidate with one pinned rubric. The public prefix, the learner
 * utterances, the world, and the evidence state are all frozen from a recorded
 * run, so the only thing that varies between arms is how much private planner
 * context the speaking tutor receives.
 *
 * This is a visual and diagnostic instrument, not evidence about human
 * learning. It never regenerates the learner, reruns the classifier or DAG, or
 * continues the dialogue past the recorded turns.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

import { callAIWithCliBridge } from './cliProviderBridge.js';
import {
  buildCommitteeCompositionBlock,
  committeeMiniGenerate,
  committeeQuestionSentences,
  PROGRAM2_COMMITTEE_DEFAULTS,
  PROGRAM2_WARRANT_CUE_RE,
  runCommitteeBattery,
} from './program2CommitteeEngine.js';
import { loadWorld } from './dramaticDerivation/world.js';
import {
  auditTutorStubFrozenCandidate,
  refreshTutorStubFrozenFirstDraftRequest,
  TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
} from './tutorStubFrozenReplay.js';
import {
  splitTutorStubAbClusters,
  tutorStubAbRuleKeying,
  tutorStubAbRuleKeyingReason,
} from './tutorStubAbRuleKeying.js';
import { normalizeTokenUsage } from './tokenUsage.js';
import {
  projectTutorStubAbRequest,
  resolveTutorStubAbArm,
  resolveTutorStubAbGuardSet,
  TUTOR_STUB_AB_FEATURE_IDS,
} from './tutorStubAbArms.js';

export const TUTOR_STUB_AB_CONFIG_SCHEMA = 'machinespirits.tutor-stub.ab-config.v1';
export const TUTOR_STUB_AB_PLAN_SCHEMA = 'machinespirits.tutor-stub.ab-plan.v1';
export const TUTOR_STUB_AB_REPORT_SCHEMA = 'machinespirits.tutor-stub.ab-report.v1';

/**
 * Speaking-model providers.
 *
 * `codex` and `claude-code` are the CLI bridges. `ollama` is the locally served
 * lane, added so a Program-2 fine-tune can stand in the comparison as another
 * version of the tutor: the other arms vary what reaches the prompt, this one
 * varies who is reading it. It reuses the Phase-5 client
 * (`committeeMiniGenerate`) rather than opening a second way to call the same
 * endpoint, so the serving pin — native chat API, thinking off, greedy — stays
 * in one place.
 */
const CLI_BRIDGE_PROVIDERS = new Set(['codex', 'claude-code']);
const MODEL_PROVIDERS = new Set([...CLI_BRIDGE_PROVIDERS, 'ollama', 'committee']);
const TERMINAL_STATUSES = new Set(['complete', 'blocked', 'budget_exhausted']);

/**
 * Frozen-replay invariants. These stay false for the same reason the PR
 * benchmark keeps them false: the moment any of them turns on, the arms stop
 * sharing a prefix and the comparison stops being a comparison.
 */
const REQUIRED_INVARIANTS = Object.freeze([
  'regenerate_prior_dialogue',
  'generate_learner',
  'classify_learner',
  'update_learner_dag',
  'continue_dialogue',
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

function resolveRepoPath(root, relativePath, label) {
  if (!String(relativePath || '').trim() || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes the repository root`);
  return target;
}

export function loadTutorStubAbConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8');
  return { config: yaml.parse(source), source, configSha256: sha256(source), configPath: path.resolve(configPath) };
}

export function validateTutorStubAbConfig(config) {
  if (!config || config.schema !== TUTOR_STUB_AB_CONFIG_SCHEMA) {
    throw new Error(`A/B config schema must be ${TUTOR_STUB_AB_CONFIG_SCHEMA}`);
  }
  if (!config.models || !config.arms || !config.scenarios || !config.presets) {
    throw new Error('A/B config requires models, arms, scenarios, and presets');
  }
  for (const [id, model] of Object.entries(config.models)) {
    if (!MODEL_PROVIDERS.has(model?.provider)) {
      throw new Error(`model ${id} must use codex, claude-code, or ollama`);
    }
    if (!String(model.model || '').trim()) throw new Error(`model ${id} requires model`);
    positiveInt(model.timeout_ms, `model ${id}.timeout_ms`);
    if (model.provider === 'committee') {
      // Program-2's own arrangement: the tuned mini writes one question, a
      // frontier model writes the turn around it verbatim. Both halves are
      // named here so a report says which mini and which composer produced a
      // row — the whole point of the lane is that neither alone is the speaker.
      const mini = model.mini || {};
      const composer = model.composer || {};
      if (!String(mini.model || '').trim()) throw new Error(`model ${id} requires mini.model`);
      if (!String(mini.base_url || '').trim()) throw new Error(`model ${id} requires mini.base_url`);
      positiveInt(mini.num_ctx, `model ${id}.mini.num_ctx`);
      positiveInt(mini.max_tokens, `model ${id}.mini.max_tokens`);
      positiveInt(mini.timeout_ms, `model ${id}.mini.timeout_ms`);
      if (!CLI_BRIDGE_PROVIDERS.has(composer.provider)) {
        throw new Error(`model ${id}.composer.provider must be codex or claude-code`);
      }
      if (!String(composer.model || '').trim()) throw new Error(`model ${id} requires composer.model`);
    }
    if (model.provider === 'ollama') {
      // The context window is the one setting that silently turns a real score
      // into a truncation artifact: the instrumented arms send ~6k characters
      // of advisories on top of the world and the prefix. Make it explicit per
      // model rather than inheriting a default that may not fit.
      positiveInt(model.num_ctx, `model ${id}.num_ctx`);
      positiveInt(model.max_tokens, `model ${id}.max_tokens`);
      if (!String(model.base_url || '').trim()) throw new Error(`model ${id} requires base_url`);
    }
  }
  const arms = Object.entries(config.arms).map(([id, definition]) => resolveTutorStubAbArm(id, definition));
  const baselines = arms.filter((arm) => arm.baseline);
  if (baselines.length !== 1) throw new Error('exactly one arm must be marked baseline: true');
  if (baselines[0].features.length !== 0) {
    throw new Error(`baseline arm ${baselines[0].id} must carry no instrumentation features`);
  }
  for (const [id, scenario] of Object.entries(config.scenarios)) {
    if (!String(scenario?.fixture || '').trim()) throw new Error(`scenario ${id} requires fixture`);
    if (scenario.turns !== undefined && scenario.turns !== 'all' && !Array.isArray(scenario.turns)) {
      throw new Error(`scenario ${id}.turns must be "all" or a list of fixture case ids`);
    }
  }
  for (const [id, preset] of Object.entries(config.presets)) {
    for (const key of ['models', 'arms', 'scenarios']) {
      const list = preset?.[key];
      if (!Array.isArray(list) || !list.length) throw new Error(`preset ${id}.${key} must be a non-empty list`);
      for (const entry of list) {
        if (!config[key][entry]) throw new Error(`preset ${id} references unknown ${key.slice(0, -1)} ${entry}`);
      }
    }
  }
  positiveInt(config.budgets?.max_calls, 'budgets.max_calls');
  if (config.budgets?.concurrency !== 1) throw new Error('budgets.concurrency must remain 1');
  if (config.budgets?.retries_per_job !== 0) throw new Error('budgets.retries_per_job must remain 0');
  if (config.rubric?.pin_guards_to_reference !== true) {
    throw new Error('rubric.pin_guards_to_reference must remain true; arms must share one rubric');
  }
  for (const name of REQUIRED_INVARIANTS) {
    if (config.invariants?.[name] !== false) throw new Error(`invariant ${name} must remain false`);
  }
  return { config, arms };
}

function loadScenario({ root, id, definition }) {
  const fixturePath = resolveRepoPath(root, definition.fixture, `scenario ${id}.fixture`);
  const source = fs.readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(source);
  if (fixture.schema !== TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA) {
    throw new Error(`scenario ${id} fixture schema must be ${TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA}`);
  }
  const available = fixture.cases || [];
  const wanted = definition.turns === undefined || definition.turns === 'all' ? null : definition.turns.map(String);
  const rows = (wanted ? wanted.map((caseId) => available.find((item) => item.id === caseId)) : available).map(
    (row, index) => {
      if (!row?.bundle) throw new Error(`scenario ${id} has no frozen bundle for row ${wanted?.[index] || index}`);
      return row;
    },
  );
  if (!rows.length) throw new Error(`scenario ${id} selected no turns`);
  const worldIds = [...new Set(rows.map((row) => row.bundle.worldId))];
  if (worldIds.length !== 1) throw new Error(`scenario ${id} spans ${worldIds.length} worlds; expected exactly one`);
  return {
    id,
    label: String(definition.label || id),
    criterion: definition.criterion || null,
    fixture: definition.fixture,
    fixtureSha256: sha256(source),
    worldId: worldIds[0],
    learnerProfile: rows[0].bundle.learnerProfile || null,
    turns: rows
      .map((row) => ({
        caseId: row.id,
        turn: Number(row.bundle.turn),
        learnerText: row.bundle.learnerText,
        recordedTutorText:
          row.bundle.recorded?.finalDelivery?.candidate?.text ||
          row.bundle.recorded?.originalCandidate?.candidate?.text ||
          null,
        referenceGuards: clone(row.bundle.guards || {}),
        bundle: clone(row.bundle),
      }))
      .sort((left, right) => left.turn - right.turn),
  };
}

function worldForId(root, worldId) {
  const worldDir = path.join(root, 'config', 'drama-derivation');
  const matches = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => loadWorld(path.join(worldDir, name)))
    .filter((world) => world.id === worldId);
  if (matches.length !== 1) throw new Error(`expected exactly one world for ${worldId}, found ${matches.length}`);
  return matches[0];
}

export function buildTutorStubAbPlan({
  config,
  root,
  preset = 'default',
  arms = null,
  scenarios = null,
  models = null,
  maxCalls = null,
  configSha256 = null,
  featureOverride = null,
  dropOverride = null,
} = {}) {
  const { config: validated, arms: allArms } = validateTutorStubAbConfig(config);
  const selectedPreset = validated.presets[preset];
  if (!selectedPreset) throw new Error(`unknown A/B preset ${preset}`);
  const armIds = [...new Set((arms || selectedPreset.arms).map(String))];
  const scenarioIds = [...new Set((scenarios || selectedPreset.scenarios).map(String))];
  const modelIds = [...new Set((models || selectedPreset.models).map(String))];
  for (const id of armIds) if (!validated.arms[id]) throw new Error(`unknown selected arm ${id}`);
  for (const id of scenarioIds) if (!validated.scenarios[id]) throw new Error(`unknown selected scenario ${id}`);
  for (const id of modelIds) if (!validated.models[id]) throw new Error(`unknown selected model ${id}`);

  // Ad-hoc feature selection. The baseline is never overridden: it is the
  // no-instrumentation reference the other lanes are diffed against, and an
  // override that quietly gave it advisories would make every delta meaningless.
  const resolvedArms = armIds.map((id) => {
    const arm = allArms.find((entry) => entry.id === id);
    if (arm.baseline || (featureOverride === null && dropOverride === null)) return arm;
    return resolveTutorStubAbArm(id, {
      ...validated.arms[id],
      features: featureOverride === null ? validated.arms[id].features : featureOverride,
      drop: dropOverride === null ? validated.arms[id].drop : dropOverride,
    });
  });
  const baselineArm = resolvedArms.find((arm) => arm.baseline);
  if (!baselineArm) throw new Error('selected arms must include the baseline arm');
  const nonBaseline = resolvedArms.filter((arm) => !arm.baseline);
  // The length target is part of the signature: two arms with no features and
  // different target lengths are distinct lanes, and two with the same target
  // are the duplicate this check exists to catch.
  const signatures = new Set(nonBaseline.map((arm) => `${arm.features.join('|')}@${arm.lengthTargetChars ?? ''}`));
  if (nonBaseline.length > 1 && signatures.size !== nonBaseline.length) {
    throw new Error('selected arms resolve to duplicate feature sets; a feature override collapsed distinct arms');
  }

  const resolvedScenarios = scenarioIds.map((id) => loadScenario({ root, id, definition: validated.scenarios[id] }));

  const jobs = [];
  for (const scenario of resolvedScenarios) {
    for (const turn of scenario.turns) {
      for (const modelId of modelIds) {
        for (const arm of resolvedArms) {
          jobs.push({
            id: `${scenario.id}__${turn.caseId}__${arm.id}__${modelId}`,
            scenarioId: scenario.id,
            caseId: turn.caseId,
            turn: turn.turn,
            armId: arm.id,
            arm: clone(arm),
            modelId,
            model: clone(validated.models[modelId]),
            worldId: scenario.worldId,
            learnerText: turn.learnerText,
            bundle: clone(turn.bundle),
          });
        }
      }
    }
  }

  const callBudget = maxCalls === null ? validated.budgets.max_calls : positiveInt(maxCalls, 'maxCalls');
  return {
    schema: TUTOR_STUB_AB_PLAN_SCHEMA,
    preset,
    armIds,
    scenarioIds,
    modelIds,
    baselineArmId: baselineArm.id,
    arms: resolvedArms.map(clone),
    scenarios: resolvedScenarios.map((scenario) => ({
      ...scenario,
      turns: scenario.turns.map(({ bundle: _bundle, ...rest }) => rest),
    })),
    jobs,
    plannedCalls: jobs.length,
    maxCalls: callBudget,
    status: jobs.length > callBudget ? 'budget_exhausted' : 'ready',
    configSha256,
    rubric: clone(validated.rubric),
    invariants: clone(validated.invariants),
  };
}

export function publicTutorStubAbPlan(plan) {
  return {
    schema: plan.schema,
    preset: plan.preset,
    status: plan.status,
    plannedCalls: plan.plannedCalls,
    maxCalls: plan.maxCalls,
    configSha256: plan.configSha256,
    baselineArmId: plan.baselineArmId,
    rubric: clone(plan.rubric),
    invariants: clone(plan.invariants),
    featureRegistry: [...TUTOR_STUB_AB_FEATURE_IDS],
    arms: plan.arms.map((arm) => ({
      id: arm.id,
      label: arm.label,
      summary: arm.summary,
      baseline: arm.baseline,
      features: [...arm.features],
      omitted: [...arm.omitted],
      lengthTargetChars: arm.lengthTargetChars ?? null,
      genericPlan: arm.genericPlan === true,
      guardsClaimed: [...arm.guardsClaimed],
    })),
    scenarios: plan.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      criterion: scenario.criterion,
      fixture: scenario.fixture,
      fixtureSha256: scenario.fixtureSha256,
      worldId: scenario.worldId,
      learnerProfile: scenario.learnerProfile,
      turns: scenario.turns.map((turn) => ({ caseId: turn.caseId, turn: turn.turn, learnerText: turn.learnerText })),
    })),
    models: plan.modelIds.map((id) => {
      const model = plan.jobs.find((job) => job.modelId === id)?.model;
      return {
        id,
        provider: model.provider,
        model: model.model,
        effort: model.effort,
        timeoutMs: model.timeout_ms,
        // Recorded so a report says what window the reply was written in — a
        // low score under a small window is a truncation artifact, not a result.
        numCtx: model.num_ctx ?? null,
        maxTokens: model.max_tokens ?? null,
      };
    }),
    jobs: plan.jobs.map((job) => ({
      id: job.id,
      scenarioId: job.scenarioId,
      caseId: job.caseId,
      turn: job.turn,
      armId: job.armId,
      modelId: job.modelId,
    })),
  };
}

/**
 * Freeze the turn: recompile the current first-draft contract against the
 * immutable public prefix, then project the request down to the arm.
 */
export function prepareTutorStubAbJob(job, { root, loadWorldForId = worldForId } = {}) {
  const originalPrefix = JSON.stringify(job.bundle.priorTurns || []);
  const originalLearnerText = job.bundle.learnerText;
  const world = loadWorldForId(root, job.worldId);
  const bundle = refreshTutorStubFrozenFirstDraftRequest({ bundle: clone(job.bundle), world });
  if (JSON.stringify(bundle.priorTurns || []) !== originalPrefix || bundle.learnerText !== originalLearnerText) {
    throw new Error(`job ${job.id} changed its frozen public prefix`);
  }
  const projection = projectTutorStubAbRequest({ bundle, arm: job.arm });
  return { bundle, world, projection, latest: projection.latest, history: projection.history };
}

/**
 * The Program-2 committee, run as one speaker.
 *
 * Faithful to PROGRAM-2-PHASE5B §2: the mini answers the moment, its question
 * sentence becomes the protected span (the one carrying a warrant cue if there
 * is one, else the first), the composer writes the turn around that span
 * verbatim, and the pre-delivery check confirms the span survived and that the
 * turn asks exactly one question. Any failure keeps the mini's own reply.
 *
 * What is deliberately NOT reproduced is the resample/trim/greedy ladder Phase
 * 5b delivered through. Every other version of the tutor in this bench is
 * graded on its first reply; giving one lane retries would measure the ladder.
 */
async function generateCommitteeCandidate({ job, prepared }) {
  const startedAt = Date.now();
  const { mini: miniConfig, composer } = job.model;
  const messages = [...prepared.history, { role: 'user', content: prepared.latest.content }];
  const mini = await committeeMiniGenerate({
    url: miniConfig.base_url,
    model: miniConfig.model,
    systemPrompt: prepared.projection.systemPrompt,
    messages,
    numCtx: miniConfig.num_ctx,
    maxTokens: miniConfig.max_tokens,
    timeoutMs: miniConfig.timeout_ms,
  });
  const questions = committeeQuestionSentences(mini.text);
  const span = questions.find((question) => PROGRAM2_WARRANT_CUE_RE.test(question)) || questions[0] || null;
  const trace = { miniModel: miniConfig.model, composerModel: composer.model, miniChars: mini.text.length, span };

  // No question to protect means there is nothing for the committee to carry.
  // The mini's reply stands rather than the composer silently becoming a
  // frontier-alone lane that reports as a committee row.
  if (!span) {
    return {
      text: mini.text,
      latencyMs: Date.now() - startedAt,
      provider: 'committee',
      model: `${miniConfig.model}+${composer.model}`,
      tokenUsageAvailable: false,
      committee: { ...trace, delivered: 'mini', reason: 'no_question_span' },
    };
  }

  const composed = await callAIWithCliBridge(
    { provider: composer.provider, model: composer.model },
    prepared.projection.systemPrompt,
    `${prepared.latest.content}\n\n${buildCommitteeCompositionBlock(span)}`,
    'tutor_stub_ab_committee',
    { messageHistory: prepared.history, effort: composer.effort, timeoutMs: job.model.timeout_ms },
  );
  const composedText = String(composed?.text || '').trim();
  const battery = runCommitteeBattery({ composedText, span });
  return {
    text: battery.pass ? composedText : mini.text,
    latencyMs: Date.now() - startedAt,
    provider: 'committee',
    model: `${miniConfig.model}+${composer.model}`,
    tokenUsageAvailable: false,
    committee: {
      ...trace,
      delivered: battery.pass ? 'composed' : 'mini',
      reason: battery.failedCheck,
      composedChars: composedText.length,
    },
  };
}

async function defaultGenerateCandidate({ job, prepared }) {
  if (job.model.provider === 'committee') return await generateCommitteeCandidate({ job, prepared });
  if (job.model.provider === 'ollama') {
    // No fallback battery here. Phase 5b delivered mini replies through a
    // resample/trim/greedy ladder; running that would measure the ladder as
    // much as the weights. This takes the first reply as spoken, which is the
    // same deal every other version of the tutor in this bench gets.
    const generated = await committeeMiniGenerate({
      url: job.model.base_url || PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl,
      model: job.model.model,
      systemPrompt: prepared.projection.systemPrompt,
      messages: [...prepared.history, { role: 'user', content: prepared.latest.content }],
      numCtx: job.model.num_ctx,
      maxTokens: job.model.max_tokens,
      timeoutMs: job.model.timeout_ms,
    });
    return { ...generated, provider: 'ollama', model: job.model.model, tokenUsageAvailable: false };
  }
  return await callAIWithCliBridge(
    { provider: job.model.provider, model: job.model.model },
    prepared.projection.systemPrompt,
    prepared.latest.content,
    'tutor_stub_ab_instrumentation',
    {
      messageHistory: prepared.history,
      effort: job.model.effort,
      timeoutMs: job.model.timeout_ms,
    },
  );
}

/**
 * The shared rubric. Every arm is audited against the reference guard set from
 * the recorded run, so dropping an advisory makes its guard harder to satisfy
 * rather than switching the guard off.
 */
export function auditTutorStubAbCandidate({ prepared, text, pinGuards = true }) {
  const bundle = pinGuards
    ? { ...prepared.bundle, guards: resolveTutorStubAbGuardSet(prepared.bundle.guards) }
    : prepared.bundle;
  return auditTutorStubFrozenCandidate({
    bundle,
    world: prepared.world,
    text,
    candidateKind: 'original_candidate',
  });
}

function errorRecord(error) {
  return { name: error?.name || 'Error', code: error?.code || null, message: String(error?.message || error) };
}

export async function runTutorStubAb({
  plan,
  root,
  generateCandidate = defaultGenerateCandidate,
  auditCandidate = auditTutorStubAbCandidate,
  loadWorldForId = worldForId,
  metadata = {},
  onProgress = null,
  now = () => new Date(),
} = {}) {
  const startedAt = now().toISOString();
  if (plan.status === 'budget_exhausted') {
    return {
      schema: TUTOR_STUB_AB_REPORT_SCHEMA,
      status: 'budget_exhausted',
      startedAt,
      completedAt: now().toISOString(),
      metadata,
      plan: publicTutorStubAbPlan(plan),
      results: [],
      summary: summarizeTutorStubAb({ plan, results: [] }),
    };
  }
  const results = [];
  const blockedModels = new Map();
  for (const job of plan.jobs) {
    if (blockedModels.has(job.modelId)) {
      results.push({
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        called: false,
        error: { ...blockedModels.get(job.modelId), message: `model blocked by earlier call: ${job.modelId}` },
      });
      continue;
    }
    const started = Date.now();
    try {
      const prepared = prepareTutorStubAbJob(job, { root, loadWorldForId });
      const generated = await generateCandidate({ job, prepared });
      const candidate = String(generated?.text || '').trim();
      const audit = await auditCandidate({
        job,
        prepared,
        text: candidate,
        pinGuards: plan.rubric?.pin_guards_to_reference !== false,
      });
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        provider: generated?.provider || job.model.provider,
        model: generated?.model || job.model.model,
        effort: generated?.effort || generated?.reasoningEffort || job.model.effort,
        status: audit?.ok === true ? 'pass' : 'fail',
        called: true,
        latencyMs: Number(generated?.latencyMs || Date.now() - started),
        usage: normalizeTokenUsage(generated, { available: generated?.tokenUsageAvailable }),
        learnerText: job.learnerText,
        // Which half of a committee actually spoke. A lane that keeps falling
        // back to the mini is not the arrangement its label claims.
        committee: generated?.committee ?? null,
        candidate,
        auditedText: audit?.auditedText || candidate,
        safetyFailure: audit?.safetyFailure === true,
        failureClusters: audit?.failureClusters || [],
        hardFailureClusters: audit?.hardFailureClusters || [],
        advisoryFailureClusters: audit?.advisoryFailureClusters || [],
        projection: {
          retainedFeatures: prepared.projection.retainedFeatures,
          strippedFeatures: prepared.projection.strippedFeatures,
          advisoryChars: prepared.projection.advisoryChars,
          requestChars: prepared.projection.requestChars,
        },
        guardSet: prepared.bundle.guards,
        audit,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    } catch (error) {
      const recorded = errorRecord(error);
      blockedModels.set(job.modelId, recorded);
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        called: true,
        latencyMs: Date.now() - started,
        learnerText: job.learnerText,
        error: recorded,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    }
  }
  const summary = summarizeTutorStubAb({ plan, results });
  const status = results.some((row) => row.status === 'blocked') ? 'blocked' : 'complete';
  if (!TERMINAL_STATUSES.has(status)) throw new Error(`non-terminal A/B status ${status}`);
  return {
    schema: TUTOR_STUB_AB_REPORT_SCHEMA,
    status,
    startedAt,
    completedAt: now().toISOString(),
    metadata,
    plan: publicTutorStubAbPlan(plan),
    results,
    summary,
  };
}

function tallyClusters(rows, key = 'failureClusters') {
  const counts = new Map();
  for (const row of rows) for (const cluster of row[key] || []) counts.set(cluster, (counts.get(cluster) || 0) + 1);
  return counts;
}

function sumClusters(counts) {
  let total = 0;
  for (const count of counts.values()) total += count;
  return total;
}

/**
 * The same tally split by whether an untold tutor could have satisfied the rule.
 * The bench grades every arm against a plan it shows to one of them, so the
 * headline total is not a ruler the arms start level on; the `open` half is.
 */
function splitTally(counts) {
  const flat = [];
  for (const [cluster, count] of counts) for (let i = 0; i < count; i += 1) flat.push(cluster);
  return splitTutorStubAbClusters(flat);
}

export function summarizeTutorStubAb({ plan, results }) {
  const baselineArmId = plan.baselineArmId;
  const byArm = new Map();
  for (const armId of plan.armIds) byArm.set(armId, []);
  for (const row of results) if (byArm.has(row.armId)) byArm.get(row.armId).push(row);

  const baselineRows = byArm.get(baselineArmId) || [];
  const baselineClusters = tallyClusters(baselineRows);
  const baselineHardClusters = tallyClusters(baselineRows, 'hardFailureClusters');
  const baselineSplit = splitTally(baselineClusters);
  const baselineTotals = { clusters: sumClusters(baselineClusters), hard: sumClusters(baselineHardClusters) };
  const baselinePassById = new Map(baselineRows.map((row) => [`${row.caseId}__${row.modelId}`, row.status]));

  const arms = plan.armIds.map((armId) => {
    const rows = byArm.get(armId) || [];
    const scored = rows.filter((row) => row.called && row.status !== 'blocked');
    const pass = scored.filter((row) => row.status === 'pass').length;
    const clusters = tallyClusters(rows);
    const hardClusters = tallyClusters(rows, 'hardFailureClusters');
    const totalClusters = sumClusters(clusters);
    const totalHardClusters = sumClusters(hardClusters);
    const split = splitTally(clusters);
    const clusterDeltas = [...new Set([...clusters.keys(), ...baselineClusters.keys()])]
      .map((cluster) => ({
        cluster,
        arm: clusters.get(cluster) || 0,
        baseline: baselineClusters.get(cluster) || 0,
        delta: (clusters.get(cluster) || 0) - (baselineClusters.get(cluster) || 0),
        keying: tutorStubAbRuleKeying(cluster),
        keyingReason: tutorStubAbRuleKeyingReason(cluster),
      }))
      .filter((entry) => entry.delta !== 0 || entry.arm > 0)
      .sort((left, right) => left.delta - right.delta || left.cluster.localeCompare(right.cluster));
    const flips = rows
      .filter((row) => row.called && row.status !== 'blocked')
      .map((row) => {
        const before = baselinePassById.get(`${row.caseId}__${row.modelId}`);
        if (!before || before === row.status) return null;
        return { caseId: row.caseId, turn: row.turn, modelId: row.modelId, from: before, to: row.status };
      })
      .filter(Boolean);
    const armPlan = plan.arms.find((entry) => entry.id === armId);
    return {
      id: armId,
      label: armPlan?.label || armId,
      baseline: armId === baselineArmId,
      features: armPlan ? [...armPlan.features] : [],
      turns: rows.length,
      scored: scored.length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
      pass,
      fail: scored.length - pass,
      passRate: scored.length ? pass / scored.length : null,
      safetyFailures: rows.filter((row) => row.safetyFailure).length,
      // Pass rate can sit at 0/N for every arm when a rubric check fails
      // universally, so the comparable signal is how many failure clusters an
      // arm accumulates against the baseline's tally over the same turns.
      totalClusters,
      totalHardClusters,
      meanClusters: scored.length ? Number((totalClusters / scored.length).toFixed(2)) : null,
      meanHardClusters: scored.length ? Number((totalHardClusters / scored.length).toFixed(2)) : null,
      clusterDeltaTotal: armId === baselineArmId ? 0 : totalClusters - baselineTotals.clusters,
      hardClusterDeltaTotal: armId === baselineArmId ? 0 : totalHardClusters - baselineTotals.hard,
      // The same tally split by whether an arm holding no plan could have
      // satisfied the rule. `open` is the comparable half; `told` is the half
      // the bench hands to whichever arm carries the contract, and its size is
      // the measured bias of the headline number rather than an assertion about it.
      openClusters: split.open,
      toldClusters: split.told,
      unclassifiedClusters: split.unclassified,
      unclassifiedRules: split.unclassifiedRules,
      openClusterDeltaTotal: armId === baselineArmId ? 0 : split.open - baselineSplit.open,
      toldClusterDeltaTotal: armId === baselineArmId ? 0 : split.told - baselineSplit.told,
      meanOpenClusters: scored.length ? Number((split.open / scored.length).toFixed(2)) : null,
      meanAdvisoryChars: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.projection?.advisoryChars || 0), 0) / scored.length)
        : null,
      meanCandidateChars: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.candidate?.length || 0), 0) / scored.length)
        : null,
      meanLatencyMs: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.latencyMs || 0), 0) / scored.length)
        : null,
      clusterDeltas,
      flipsVsBaseline: flips,
    };
  });

  return {
    baselineArmId,
    totalJobs: plan.plannedCalls,
    completed: results.filter((row) => row.called && row.status !== 'blocked').length,
    blocked: results.filter((row) => row.status === 'blocked').length,
    arms,
  };
}

export function renderTutorStubAbMarkdown(report) {
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  const pct = (value) => (value === null ? '—' : `${Math.round(value * 100)}%`);
  const signed = (value) => (value > 0 ? `+${value}` : String(value));
  const lines = [
    '# Tutor instrumentation A/B',
    '',
    `- Status: **${report.status}**`,
    `- Preset: \`${report.plan.preset}\``,
    `- Baseline arm: \`${report.summary.baselineArmId}\``,
    `- Calls: ${report.results.filter((row) => row.called).length}/${report.plan.maxCalls}`,
    `- Commit: \`${report.metadata?.gitSha || 'unknown'}\``,
    '',
    '## Arms',
    '',
    'Failure clusters are the headline. Pass is all-or-nothing per turn and can read',
    '0/N for every arm at once; the cluster tallies say how far each arm is from clean.',
    '',
    'Read the **open** column, not the total. The bench computes a performance',
    'contract for every turn and grades every arm against it, but shows it to one of',
    'them, so the total is not a ruler the arms start level on. Open counts only the',
    'rules an arm holding no plan could still have satisfied — prohibitions, shape',
    'rules, and anything judged against the learner’s own public turn. Told counts the',
    'rest, and its size is the measured bias of the total.',
    '',
    '| Arm | Features | Turns | Open | vs baseline | Told | Clusters (hard) | vs baseline | Pass | Safety | Advisory chars | Reply chars | Latency |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const arm of report.summary.arms) {
    const versus = arm.baseline ? '—' : `${signed(arm.clusterDeltaTotal)} (${signed(arm.hardClusterDeltaTotal)})`;
    const openVersus = arm.baseline ? '—' : signed(arm.openClusterDeltaTotal);
    lines.push(
      `| ${cell(arm.label)}${arm.baseline ? ' _(baseline)_' : ''} | ${cell(arm.features.join(', ') || 'none')} | ${arm.scored} | ${arm.openClusters} | ${openVersus} | ${arm.toldClusters} | ${arm.totalClusters} (${arm.totalHardClusters}) | ${versus} | ${arm.pass}/${arm.scored} (${pct(arm.passRate)}) | ${arm.safetyFailures} | ${arm.meanAdvisoryChars ?? '—'} | ${arm.meanCandidateChars ?? '—'} | ${arm.meanLatencyMs ?? '—'} ms |`,
    );
  }
  const unclassified = [...new Set(report.summary.arms.flatMap((arm) => arm.unclassifiedRules || []))].sort();
  if (unclassified.length) {
    lines.push(
      '',
      `**${unclassified.length} rule(s) are in neither column** — nobody has said whether an arm holding`,
      'no plan could have satisfied them, so they are left out of both totals:',
      '',
      ...unclassified.map((rule) => `- \`${rule}\``),
    );
  }
  for (const arm of report.summary.arms.filter((entry) => !entry.baseline)) {
    if (!arm.clusterDeltas.length && !arm.flipsVsBaseline.length) continue;
    lines.push('', `## ${arm.label} vs baseline`, '');
    if (arm.clusterDeltas.length) {
      lines.push(
        `Open ${signed(arm.openClusterDeltaTotal)}, told ${signed(arm.toldClusterDeltaTotal)}.`,
        '',
        '| Failure cluster | Keyed on | Baseline | Arm | Delta |',
        '| --- | --- | ---: | ---: | ---: |',
      );
      for (const entry of arm.clusterDeltas) {
        lines.push(
          `| ${cell(entry.cluster)} | ${entry.keying}${entry.keyingReason ? ` — ${cell(entry.keyingReason)}` : ''} | ${entry.baseline} | ${entry.arm} | ${entry.delta > 0 ? '+' : ''}${entry.delta} |`,
        );
      }
    }
    if (arm.flipsVsBaseline.length) {
      lines.push(
        '',
        ...arm.flipsVsBaseline.map((flip) => `- turn ${flip.turn} (${flip.modelId}): ${flip.from} → ${flip.to}`),
      );
    }
  }
  lines.push(
    '',
    'Frozen-replay comparison over a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaker receives varies. Every arm is graded by the same pinned guard set. This is a visual and regression instrument, not evidence about human learning.',
    '',
  );
  return lines.join('\n');
}
