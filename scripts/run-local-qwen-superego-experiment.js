#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { normalizeLocalLearnerSpec } from './run-local-qwen-resistant-learner.js';
import { readBenchmarkArm, scoreBenchmarkArms } from './score-local-qwen-resistant-learner-benchmark.js';
import { renderFactorialReport } from '../services/localQwenFactorialReport.js';
import { loadRubric } from '../services/evalConfigLoader.js';
import { loadLearnerRubric } from '../services/learnerRubricEvaluator.js';
import { loadDialogueRubric } from '../services/rubricEvaluator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PLAN = path.join(ROOT, 'config/tutor-stub-local-learners/qwen-superego-factorial.v1.yaml');
const readYaml = (file) => yaml.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

export function buildFactorialPlan(config = readYaml(DEFAULT_PLAN)) {
  if (
    config.id !== 'qwen-superego-factorial-v1' ||
    config.turns !== 8 ||
    config.judge_calls !== 16 ||
    config.total_attempt_ceiling !== 112
  )
    throw new Error('this bounded experiment requires four eight-turn arms and a 112-attempt ceiling');
  const base = readYaml(path.resolve(ROOT, config.base_spec));
  const arms = config.arms.map((arm) => {
    if (!['normal', 'abliterated'].includes(arm.variant) || !['direct', 'ego_superego'].includes(arm.mode))
      throw new Error('unknown factorial arm');
    const raw = structuredClone(base);
    raw.id = `${config.id}-${arm.id}`;
    raw.models.learner = arm.variant === 'normal' ? 'mlx-local.qwen-normal-27b' : 'mlx-local.qwen-abliterated-27b';
    raw.local_service.profile = arm.variant === 'normal' ? 'regular' : 'uncensored';
    raw.local_service.model_id_contains =
      arm.variant === 'normal'
        ? 'mlx-community/Qwen3.8-27B-4bit'
        : '/Users/lmagee/Dev/mlx-qwen/models/Qwen3.8-27B-Uncensored-MLX/4-bit';
    raw.generation.system_prompt_style = config.system_prompt_style;
    raw.generation.deliberation = {
      mode: arm.mode,
      superego_model: config.superego_model,
      superego_prompt_style: config.superego_prompt_style,
      superego_effort: config.superego_effort,
    };
    raw.run.turns = config.turns;
    raw.run.model_call_budget = config.turns * (arm.mode === 'direct' ? 2 : 4);
    const spec = normalizeLocalLearnerSpec(raw);
    if (!/^[A-D]$/u.test(arm.id)) throw new Error('arm ids must be A–D');
    if (
      spec.models.tutor !== 'codex.gpt-5.6-sol' ||
      spec.models.tutorEffort !== 'medium' ||
      spec.generation.temperature !== 0.6 ||
      spec.profile !== 'counterexample_hunter' ||
      spec.run.stopOnGrounded
    )
      throw new Error('shared character/tutor/decoding configuration changed; revise the experiment design first');
    if (
      config.superego_model !== 'codex.gpt-5.6-luna' ||
      config.superego_effort !== 'low' ||
      config.system_prompt_style !== 'active_resistance_v2' ||
      config.superego_prompt_style !== 'evidence_novelty_v2'
    )
      throw new Error('configured prompt/mechanism differs from this experiment');
    return { ...arm, raw, spec, cap: spec.run.modelCallBudget };
  });
  if (
    arms.length !== 4 ||
    new Set(arms.map((arm) => `${arm.variant}/${arm.mode}`)).size !== 4 ||
    new Set(arms.map((arm) => arm.id)).size !== 4
  )
    throw new Error('all four unique factorial conditions are required');
  const generationCap = arms.reduce((sum, arm) => sum + arm.cap, 0);
  if (generationCap + config.judge_calls !== config.total_attempt_ceiling)
    throw new Error('aggregate ceiling mismatch');
  for (const rubric of [loadRubric(), loadLearnerRubric(), loadDialogueRubric()])
    if (String(rubric.version) !== '2.2') throw new Error('active rubric version changed from planned v2.2');
  return { ...config, arms, generationCap, root: ROOT };
}

function child(command, args, { log, env = process.env, cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const output = fs.openSync(log, 'wx');
    const proc = spawn(command, args, { cwd, env, stdio: ['ignore', output, output] });
    proc.once('error', (error) => {
      fs.closeSync(output);
      reject(error);
    });
    proc.once('exit', (code, signal) => {
      fs.closeSync(output);
      resolve({ code: code ?? 1, signal });
    });
  });
}

function gitProvenance() {
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : 'unavailable';
  };
  return {
    commit: git(['rev-parse', 'HEAD']),
    status: git(['status', '--short']),
    enforcement: 'record only; no source-hash authorization',
  };
}

export function verifyGeneratedArm(arm, events) {
  const expected = new Map([
    ['tutor_stub_auto_learner', 8],
    ['tutor_stub_tutor', 8],
    ...(arm.mode === 'ego_superego'
      ? [
          ['tutor_stub_auto_learner_superego', 8],
          ['tutor_stub_auto_learner_revision', 8],
        ]
      : []),
  ]);
  if (
    arm.snapshot.turns.length !== 8 ||
    arm.snapshot.turns.some((turn, index) => turn.turn !== index + 1 || !turn.learner?.trim() || !turn.tutor?.trim())
  )
    throw new Error(`arm ${arm.id}: incomplete public dialogue`);
  const calls = events.filter((event) => event.type === 'model_call');
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved');
  if (calls.length !== arm.cap || reservations.length !== arm.cap)
    throw new Error(`arm ${arm.id}: call accounting differs from exact plan`);
  if (arm.technical.modelCallErrors) throw new Error(`arm ${arm.id}: model-call failure preserved; no continuation`);
  for (const [role, count] of expected) {
    const selected = calls.filter((call) => call.role === role);
    if (selected.length !== count || new Set(selected.map((call) => call.turn)).size !== 8)
      throw new Error(`arm ${arm.id}: role/turn count mismatch`);
    for (const call of selected) {
      const learner = role === 'tutor_stub_auto_learner' || role === 'tutor_stub_auto_learner_revision';
      const provider = learner ? 'mlx-local' : 'codex';
      const model = learner
        ? arm.spec.localService.modelIdContains
        : role === 'tutor_stub_tutor'
          ? 'gpt-5.6-sol'
          : 'gpt-5.6-luna';
      if (call.provider !== provider || call.model !== model)
        throw new Error(`arm ${arm.id}: realized model route drift`);
      if (
        !call.response?.text?.trim() ||
        (learner && Number(call.response?.usage?.outputTokens) >= Number(call.request?.maxTokens || Infinity))
      )
        throw new Error(`arm ${arm.id}: empty or token-ceiling output; stop without resampling`);
    }
  }
  if (calls.some((call) => !expected.has(call.role))) throw new Error(`arm ${arm.id}: unexpected model role`);
}

export async function runFactorialExperiment(
  plan,
  {
    outDir = path.resolve(ROOT, plan.output),
    dryRun = true,
    runArm = child,
    callJudge,
    mock = false,
    renderReport = renderFactorialReport,
    scoringOptions = {},
  } = {},
) {
  // Dry runs use a disposable destination; live output is always create-once.
  fs.mkdirSync(outDir, { recursive: false });
  const provenance = {
    ...gitProvenance(),
    mock,
    createdAt: new Date().toISOString(),
    attemptCeiling: plan.total_attempt_ceiling,
  };
  writeJson(path.join(outDir, 'provenance.json'), provenance);
  if (plan.design)
    fs.copyFileSync(path.resolve(ROOT, plan.design), path.join(outDir, 'design.md'), fs.constants.COPYFILE_EXCL);
  const service = readYaml(path.resolve(ROOT, plan.mtp_config));
  service.workspace.path = ROOT;
  service.timing.jsonl_path = path.join(outDir, 'server-timings.jsonl');
  const servicePath = path.join(outDir, 'service.yaml');
  fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
  const ledger = path.join(outDir, 'run-ledger.jsonl');
  const record = (event, detail = {}) =>
    fs.appendFileSync(ledger, `${JSON.stringify({ event, at: new Date().toISOString(), mock, ...detail })}\n`);
  let allocated = 0;
  const generated = [];
  try {
    for (const arm of plan.arms) {
      const dir = path.join(outDir, arm.id);
      fs.mkdirSync(dir);
      const specPath = path.join(dir, 'learner.yaml');
      const savePath = path.join(dir, 'dialogue.json');
      fs.writeFileSync(specPath, yaml.stringify(arm.raw), { flag: 'wx' });
      const args = [
        path.join(ROOT, 'scripts/run-local-qwen-resistant-learner.js'),
        '--spec',
        specPath,
        '--save',
        savePath,
        '--mtp-chat-root',
        plan.mtp_chat_root,
        '--mtp-config',
        servicePath,
        ...(dryRun ? ['--dry-run'] : []),
      ];
      if (!dryRun) {
        if (allocated + arm.cap + plan.judge_calls > plan.total_attempt_ceiling)
          throw new Error('aggregate attempt ceiling exhausted');
        allocated += arm.cap;
        record('arm_allocated', { arm: arm.id, attempts: arm.cap, allocated });
      }
      const start = Date.now();
      console.log(
        `${dryRun ? 'DRY RUN' : mock ? 'MOCK' : 'LIVE'} arm ${arm.id}: ${arm.variant}/${arm.mode}; ${arm.cap} generation attempts`,
      );
      const result = await runArm(process.execPath, args, {
        log: path.join(dir, 'console.log'),
        env: { ...process.env, TUTOR_STUB_TRACE_DIR: path.join(dir, 'traces'), TUTOR_STUB_CLI_POLICY_RETRY: 'off' },
        arm,
        savePath,
        dryRun,
      });
      if (result.code !== 0)
        throw new Error(`arm ${arm.id} stopped with exit ${result.code}; inspect preserved console.log and traces`);
      if (dryRun) {
        record('dry_run_complete', { arm: arm.id, modelAttempts: 0 });
        continue;
      }
      const completed = {
        ...readBenchmarkArm({ id: arm.id, label: `Arm ${arm.id}`, path: savePath }),
        variant: arm.variant,
        mode: arm.mode,
        cap: arm.cap,
        spec: arm.spec,
        wallTimeMs: Date.now() - start,
      };
      const traceFile = path.resolve(ROOT, completed.snapshot.trace);
      const events = fs.readFileSync(traceFile, 'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
      verifyGeneratedArm(completed, events);
      generated.push(completed);
      record('arm_completed', { arm: arm.id, callsCompleted: arm.cap, wallTimeMs: completed.wallTimeMs });
    }
    if (dryRun) {
      writeJson(path.join(outDir, 'dry-run.json'), {
        status: 'ready_for_GO_not_launched',
        modelAttempts: 0,
        generationCap: plan.generationCap,
        judgeCap: plan.judge_calls,
        totalCap: plan.total_attempt_ceiling,
      });
      return { outDir, dryRun: true };
    }
    if (allocated !== plan.generationCap || allocated + plan.judge_calls !== plan.total_attempt_ceiling)
      throw new Error('judge allocation would violate total ceiling');
    record('judge_allocated', { attempts: plan.judge_calls, allocated: allocated + plan.judge_calls });
    const judgeStart = Date.now();
    const evaluation = await scoreBenchmarkArms(generated, path.join(outDir, 'evaluation'), {
      ...scoringOptions,
      ceiling: plan.judge_calls,
      extendedQuality: true,
      ...(callJudge ? { callJudge } : {}),
    });
    const report = renderReport({
      arms: generated,
      evaluation,
      mock,
      provenance: { ...provenance, judgeWallTimeMs: Date.now() - judgeStart },
    });
    fs.writeFileSync(path.join(outDir, 'report.html'), report.html, { flag: 'wx' });
    writeJson(path.join(outDir, 'public-dialogues.json'), report.interchange);
    writeJson(path.join(outDir, 'report-data.json'), {
      evaluation,
      provenance: { ...provenance, judgeWallTimeMs: Date.now() - judgeStart },
      arms: generated.map(({ snapshot: _snapshot, ...arm }) => arm),
    });
    record('completed', { generationCompleted: allocated, judgeCompleted: evaluation.callsCompleted });
    return { outDir, evaluation, arms: generated };
  } catch (error) {
    record('stopped', { allocated, error: error.message });
    writeJson(path.join(outDir, 'stopped.json'), { error: error.message, allocated, noRetry: true });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: { live: { type: 'boolean', default: false }, plan: { type: 'string', default: DEFAULT_PLAN } },
  });
  const plan = buildFactorialPlan(readYaml(path.resolve(values.plan)));
  const previewRoot = values.live ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-factorial-preflight-'));
  const outDir = values.live ? path.resolve(ROOT, plan.output) : path.join(previewRoot, 'dry-run');
  const result = await runFactorialExperiment(plan, { outDir, dryRun: !values.live });
  console.log(
    JSON.stringify({
      outDir: result.outDir,
      status: values.live ? 'completed' : 'zero-call preflight complete; awaiting GO',
      ceiling: plan.total_attempt_ceiling,
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href)
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
