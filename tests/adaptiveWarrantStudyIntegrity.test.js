import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  appendRunEvent,
  buildExperimentRunPlan,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
} from '../services/experimentRunArtifacts.js';
import {
  ADAPTIVE_WARRANT_STUDY_DOTENV_FILE,
  adaptiveWarrantStudyCliGuardEnvironment,
  adaptiveWarrantStudyEnvironmentContract,
  buildAdaptiveWarrantStudyEnvironment,
  collectAdaptiveWarrantStudyCliContract,
  collectAdaptiveWarrantStudyRuntimeResourcePaths,
  compareAdaptiveWarrantStudyPlans,
  compareStableAdaptiveWarrantDecisions,
  fingerprintAdaptiveWarrantStudyPlan,
  projectStableAdaptiveWarrantDecision,
  verifyAdaptiveWarrantStudyCliInvocation,
  verifyAdaptiveWarrantStudyChildEvidence,
} from '../services/adaptiveWarrantStudyIntegrity.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const ROOT = path.resolve('.');

function studyPlan(rootDir, { dryRun = false } = {}) {
  const studyId = path.basename(rootDir);
  const jobs = ['observe', 'active'].map((mode, index) => {
    const id = `world-learner-${mode}`;
    const jobDir = path.join(rootDir, 'jobs', id);
    return {
      id,
      ordinal: index + 1,
      runIndex: 1,
      seed: 401 + index,
      world: 'world_022_foxtrot_jukebox',
      profile: 'diligent',
      condition: mode === 'observe' ? 'instrumented' : 'intervening',
      warrantGateMode: mode,
      horizon: 8,
      mechanismValidation: true,
      jobDir,
      command: [
        process.execPath,
        'scripts/run-tutor-stub-auto-eval.js',
        '--turns',
        '8',
        '--warrant-gate',
        mode,
        '--trace-dir',
        jobDir,
        '--parent-run-id',
        studyId,
        ...(dryRun ? ['--dry-run'] : []),
      ],
    };
  });
  return {
    schema: 'machinespirits.adaptation-refinement.baseline-study.v1',
    studyId,
    createdAt: '2026-08-10T00:00:00.000Z',
    design: 'docs/adaptation-refinement/baseline-comparison-design.md',
    config: {
      runs: 1,
      masterSeed: 401,
      horizon: 8,
      parallelism: 2,
      model: 'codex.gpt-5.6-luna',
      analysisModel: 'codex.gpt-5.6-luna',
      learnerModel: 'codex.gpt-5.6-luna',
      worlds: ['world_022_foxtrot_jukebox'],
      profiles: ['diligent'],
      conditions: [
        { id: 'instrumented', warrantGateMode: 'observe' },
        { id: 'intervening', warrantGateMode: 'active' },
      ],
      fixedSeams: ['no light adaptation', 'strict DAG'],
      dryRun,
    },
    provenance: { combinedSha256: 'a'.repeat(64) },
    jobs,
  };
}

function decisionFixture() {
  const target = {
    kind: 'weight_or_ring_result',
    signature: 'weight_or_ring_result:shilling',
    public_terms: ['shilling', 'weight', 'ring'],
    subject_terms: ['shilling'],
    required_components: [
      { id: 'weight_reading', terms: ['weight'] },
      { id: 'ring_sound', terms: ['ring'] },
    ],
    source_surface: 'Give the shilling weight and ring result.',
  };
  const obligation = {
    id: 'public-obligation-001',
    status: 'overdue',
    target,
    created_turn: 1,
    last_reminded_turn: 2,
    response_due_turn: 2,
    delivery_audit: { status: 'missing' },
    event_history: [{ type: 'created', turn: 1 }],
  };
  return {
    schema: 'machinespirits.tutor-stub.warrant-gate.v5',
    mode: 'active',
    turn: 3,
    strategy_in_force: 'stage_next_step',
    prior_delivered_action_family: 'stage_next_step',
    pre_gate_proposed_action_family: 'stage_next_step',
    strategy_since_turn: 1,
    learner_signal: { primary: 'answer_request', labels: ['answer_request'] },
    dag_total: 4,
    dag_growth: 0,
    prior_turn_outcome: { turn: 2, defeaters: ['obligation_not_answered'] },
    turns_since_dag_growth: 2,
    trouble_turns: [2],
    complaint_turns: [],
    deference_sustained: false,
    action_contract: { status: 'defeated', transition: { successor_families: ['answer_accountably'] } },
    public_obligation_before: { obligations: [obligation] },
    public_obligation: {
      speech_act: { kind: 'tutor_directed_public_result_request', creates_obligation: true, target },
      obligations: [obligation],
      blocking_obligation: obligation,
      events: [{ type: 'reminded', turn: 3, obligation_id: obligation.id }],
    },
    inquiry_completion: {
      status: 'open',
      decision_kind: 'ordinary_adaptation',
      basis: null,
      conclusion_kind: null,
      checks: { remaining_licensed_evidence_count: 1, open_public_obligation_count: 1 },
      blockers: ['open_public_obligation', 'licensed_evidence_remains'],
      transition: null,
    },
    bounded_inquiry_scope: null,
    input_snapshot: { schema: 'machinespirits.adaptation-refinement.warrant-decision-input.v2', turn: 3 },
    input_digest: 'b'.repeat(64),
    divergence: [{ dimension: 'interactional', repair_warranted: true }],
    decision_kind: 'ordinary_adaptation',
    revision_warranted: true,
    commitment_transition_warranted: true,
    current_candidate_override_required: true,
    register_revision_warranted: false,
    warrant_basis: 'public_obligation_overdue:public-obligation-001',
    policy: {
      family: 'answer_accountably',
      stance_hint: 'plain',
      rationale: 'Answer the named public request before asking anything else.',
      repair_type: 'public_obligation',
    },
    obligation_directive: {
      obligation_id: obligation.id,
      target,
      acceptable_outcomes: ['satisfied', 'deferred'],
    },
    override: {
      action_family: 'answer_accountably',
      engagement_stance: 'plain',
      reason: 'Adaptive warrant gate: public obligation is overdue.',
    },
  };
}

function experimentHashes() {
  return Object.fromEntries(
    ['runner', 'analyzer', 'policy', 'profile', 'prompt', 'world', 'config'].map((kind) => [
      kind,
      hashCanonicalJson({ kind }),
    ]),
  );
}

function createSealedChild(runDir, { runId = path.basename(runDir), parentRunId = 'parent-study' } = {}) {
  const plan = buildExperimentRunPlan({
    runId,
    createdAt: '2026-08-10T00:00:00.000Z',
    runner: 'scripts/run-tutor-stub-auto-eval.js',
    provenance: {
      git: {
        sha: '0123456789abcdef',
        branch: 'adaptation-refinement',
        dirty: false,
        fingerprintSha256: hashCanonicalJson({ clean: true }),
      },
    },
    models: {
      tutor: { requested: 'mock.tutor', resolved: 'mock.tutor' },
    },
    requiredObservedModelRoles: [],
    hashes: experimentHashes(),
    masterSeed: 401,
    jobs: [{ id: 'dynamic-r1', profile: 'diligent', policy: 'dynamic', repeat: 1 }],
    lineage: { parentRunId, resumeOf: null, supersedes: [] },
  });
  createRunPlan(runDir, plan);
  appendRunEvent(runDir, { type: 'run_started', dryRun: false, recordedAt: '2026-08-10T00:00:01.000Z' });
  fs.writeFileSync(
    path.join(runDir, 'trace.jsonl'),
    `${JSON.stringify({ schema: 'machinespirits.tutor-stub.trace.v1', type: 'turn_complete', turn: 1 })}\n`,
  );
  createRunSeal(runDir, { closedAt: '2026-08-10T00:00:02.000Z', status: 'complete' });
}

function writeFakeCodex(directory, { auth = 'Logged in using ChatGPT', version = 'codex-cli 9.9.9' } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const executable = path.join(directory, 'codex');
  fs.writeFileSync(
    executable,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then',
      `  echo ${JSON.stringify(version)}`,
      '  exit 0',
      'fi',
      'if [ "$1" = "login" ] && [ "$2" = "status" ]; then',
      `  echo ${JSON.stringify(auth)}`,
      '  exit 0',
      'fi',
      'exit 64',
      '',
    ].join('\n'),
  );
  fs.chmodSync(executable, 0o755);
  return executable;
}

function currentCodexPlatformFixture() {
  const fixture = {
    'linux:x64': ['x86_64-unknown-linux-musl', '@openai/codex-linux-x64'],
    'linux:arm64': ['aarch64-unknown-linux-musl', '@openai/codex-linux-arm64'],
    'darwin:x64': ['x86_64-apple-darwin', '@openai/codex-darwin-x64'],
    'darwin:arm64': ['aarch64-apple-darwin', '@openai/codex-darwin-arm64'],
  }[`${process.platform}:${process.arch}`];
  if (!fixture) throw new Error(`unsupported Codex package test platform: ${process.platform}/${process.arch}`);
  return { targetTriple: fixture[0], platformPackage: fixture[1] };
}

function writeFakeOfficialCodexPackage(directory) {
  const { targetTriple, platformPackage } = currentCodexPlatformFixture();
  const packageRoot = path.join(directory, 'node_modules', '@openai', 'codex');
  const binDir = path.join(packageRoot, 'bin');
  const platformPackageRoot = path.join(packageRoot, 'node_modules', ...platformPackage.split('/'));
  const nativeBinDir = path.join(platformPackageRoot, 'vendor', targetTriple, 'bin');
  const nativeExecutable = writeFakeCodex(nativeBinDir);
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@openai/codex',
        version: '9.9.9',
        type: 'module',
        bin: { codex: 'bin/codex.js' },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(platformPackageRoot, 'package.json'),
    `${JSON.stringify({ name: '@openai/codex', version: '9.9.9-test-platform' }, null, 2)}\n`,
  );
  const wrapper = path.join(binDir, 'codex.js');
  fs.writeFileSync(
    wrapper,
    [
      '#!/usr/bin/env node',
      "import { spawnSync } from 'node:child_process';",
      `const result = spawnSync(${JSON.stringify(nativeExecutable)}, process.argv.slice(2), { stdio: 'inherit', env: process.env });`,
      'if (result.error) throw result.error;',
      'process.exit(result.status ?? 1);',
      '',
    ].join('\n'),
  );
  fs.chmodSync(wrapper, 0o755);
  const command = path.join(binDir, 'codex');
  fs.symlinkSync('codex.js', command);
  return { binDir, command, wrapper, nativeExecutable, targetTriple, platformPackage };
}

function runDotenvGrandchildProbe(cwd, environment) {
  const dotenvConfigUrl = pathToFileURL(path.join(ROOT, 'node_modules', 'dotenv', 'config.js')).href;
  const source = `
    import ${JSON.stringify(dotenvConfigUrl)};
    process.stdout.write(JSON.stringify({
      CODEX_API_KEY: process.env.CODEX_API_KEY ?? null,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? null,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? null,
      TUTOR_STUB_TUTOR: process.env.TUTOR_STUB_TUTOR ?? null,
      TUTOR_STUB_WARRANT_GATE: process.env.TUTOR_STUB_WARRANT_GATE ?? null,
      DOTENV_CONFIG_PATH: process.env.DOTENV_CONFIG_PATH ?? null,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? null,
    }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd,
    env: environment,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('study plan identity is root independent and binds order, commands, models, horizon, and source', () => {
  const left = studyPlan('/tmp/study-one');
  const right = studyPlan('/tmp/study-two');
  assert.equal(compareAdaptiveWarrantStudyPlans(left, right).ok, true);

  const mutations = [
    (plan) => {
      plan.config.model = 'codex.other-model';
    },
    (plan) => {
      plan.config.horizon = 7;
      plan.jobs[0].horizon = 7;
      plan.jobs[0].command[plan.jobs[0].command.indexOf('--turns') + 1] = '7';
    },
    (plan) => {
      plan.config.fixedSeams.push('hostile extra seam');
    },
    (plan) => {
      plan.jobs.reverse();
    },
    (plan) => {
      plan.jobs[0].command.push('--point-of-action-arm', 'side_coach');
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(right);
    mutate(changed);
    assert.equal(compareAdaptiveWarrantStudyPlans(left, changed).ok, false);
  }

  // CLAUDE.md (2026-08-21): a digest over source files is a record, not part of
  // the identity. Editing a source file, or the child policy files, leaves the
  // plan identity unchanged, so a signed launch authorization and a resume
  // both survive a one-line defect fix.
  const editedSource = structuredClone(right);
  editedSource.provenance.combinedSha256 = 'c'.repeat(64);
  editedSource.jobs[0].expectedChildPolicySha256 = 'd'.repeat(64);
  assert.equal(compareAdaptiveWarrantStudyPlans(left, editedSource).ok, true);

  const dry = studyPlan('/tmp/study-dry', { dryRun: true });
  assert.notEqual(fingerprintAdaptiveWarrantStudyPlan(left).sha256, fingerprintAdaptiveWarrantStudyPlan(dry).sha256);
  assert.equal(compareAdaptiveWarrantStudyPlans(left, dry, { ignoreDryRun: true }).ok, true);
});

test('study environment defeats Node, tutor, and OpenAI route overrides while preserving login state and other providers', () => {
  const base = {
    PATH: '/usr/bin',
    HOME: '/tmp/researcher',
    CODEX_HOME: '/tmp/researcher/.codex',
    CODEX_API_KEY: 'codex-api-secret',
    OPENAI_API_KEY: 'openai-secret',
    OPENAI_BASE_URL: 'https://hostile-openai.example/v1',
    OPENAI_ORG_ID: 'hostile-org',
    OPENAI_ORGANIZATION: 'hostile-organization',
    OPENAI_PROJECT_ID: 'hostile-project',
    OPENROUTER_API_KEY: 'openrouter-secret',
    ANTHROPIC_API_KEY: 'anthropic-secret',
    DOTENV_CONFIG_PATH: '/tmp/credentials-only.env',
    DOTENV_CONFIG_OVERRIDE: 'true',
    NODE_OPTIONS: '--require=/tmp/hostile-node-hook.cjs',
    NODE_PATH: '/tmp/hostile-node-modules',
    TUTOR_STUB_TUTOR: 'rogue-tutor',
    TUTOR_STUB_TUNING: 'active',
    TUTOR_STUB_LIGHT_ADAPTATION: '1',
    TUTOR_STUB_TYPED_ACTIONS: '1',
    TUTOR_STUB_MULTIPLE_CHOICE: '1',
    TUTOR_STUB_POINT_OF_ACTION_ARM: 'side_coach',
    TUTOR_STUB_WARRANT_GATE: 'off',
    EVAL_SCENARIOS_FILE: '/tmp/hostile.yaml',
    CODEX_REASONING_EFFORT: 'xhigh',
  };
  const environment = buildAdaptiveWarrantStudyEnvironment(base);
  assert.equal(environment.HOME, base.HOME);
  assert.equal(environment.CODEX_HOME, base.CODEX_HOME);
  assert.equal(environment.CODEX_API_KEY, undefined);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.equal(environment.OPENAI_BASE_URL, undefined);
  assert.equal(environment.OPENAI_ORG_ID, undefined);
  assert.equal(environment.OPENAI_ORGANIZATION, undefined);
  assert.equal(environment.OPENAI_PROJECT_ID, undefined);
  assert.equal(environment.OPENROUTER_API_KEY, base.OPENROUTER_API_KEY);
  assert.equal(environment.ANTHROPIC_API_KEY, base.ANTHROPIC_API_KEY);
  assert.equal(environment.DOTENV_CONFIG_PATH, path.join(ROOT, ADAPTIVE_WARRANT_STUDY_DOTENV_FILE));
  assert.equal(environment.DOTENV_CONFIG_OVERRIDE, undefined);
  assert.equal(environment.NODE_OPTIONS, undefined);
  assert.equal(environment.NODE_PATH, undefined);
  assert.equal(environment.PATH, base.PATH);
  assert.equal(environment.TUTOR_STUB_TUTOR, 'dramatic-detective');
  assert.equal(environment.TUTOR_STUB_TUNING, 'off');
  assert.equal(environment.TUTOR_STUB_LIGHT_ADAPTATION, '0');
  assert.equal(environment.TUTOR_STUB_TYPED_ACTIONS, '0');
  assert.equal(environment.TUTOR_STUB_MULTIPLE_CHOICE, '0');
  assert.equal(environment.TUTOR_STUB_POINT_OF_ACTION_ARM, '');
  assert.equal(environment.TUTOR_STUB_WARRANT_GATE, undefined);
  assert.equal(environment.EVAL_SCENARIOS_FILE, undefined);
  assert.equal(environment.CODEX_REASONING_EFFORT, undefined);
  const contract = adaptiveWarrantStudyEnvironmentContract();
  assert.equal(contract.sha256.length, 64);
  assert.equal(contract.stripped_set_sha256.length, 64);
  assert.equal(contract.overrides_sha256.length, 64);
  assert.equal(contract.overrides.DOTENV_CONFIG_PATH, `{workspace}/${ADAPTIVE_WARRANT_STUDY_DOTENV_FILE}`);
  assert.equal(contract.dotenv_source.path, `{workspace}/${ADAPTIVE_WARRANT_STUDY_DOTENV_FILE}`);
  assert.equal(contract.dotenv_source.sha256.length, 64);
  assert.equal(contract.dotenv_source.active_line_count, 0);
  assert.equal(contract.cli_contract_sha256, null);
});

test('pinned empty dotenv prevents a hostile cwd .env from restoring tutor seams or API routes', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-hostile-dotenv-'));
  try {
    fs.writeFileSync(
      path.join(rootDir, '.env'),
      [
        'CODEX_API_KEY=dotenv-codex-secret',
        'OPENAI_API_KEY=dotenv-openai-secret',
        'OPENAI_BASE_URL=https://dotenv-hostile.example/v1',
        'TUTOR_STUB_TUTOR=dotenv-rogue-tutor',
        'TUTOR_STUB_WARRANT_GATE=off',
        '',
      ].join('\n'),
    );
    const environment = buildAdaptiveWarrantStudyEnvironment({
      PATH: process.env.PATH,
      HOME: path.join(rootDir, 'home'),
      CODEX_HOME: path.join(rootDir, 'codex-home'),
      OPENROUTER_API_KEY: 'retained-unrelated-provider',
    });
    const guarded = runDotenvGrandchildProbe(rootDir, environment);
    assert.equal(guarded.CODEX_API_KEY, null);
    assert.equal(guarded.OPENAI_API_KEY, null);
    assert.equal(guarded.OPENAI_BASE_URL, null);
    assert.equal(guarded.TUTOR_STUB_TUTOR, 'dramatic-detective');
    assert.equal(guarded.TUTOR_STUB_WARRANT_GATE, null);
    assert.equal(guarded.DOTENV_CONFIG_PATH, path.join(ROOT, ADAPTIVE_WARRANT_STUDY_DOTENV_FILE));
    assert.equal(guarded.OPENROUTER_API_KEY, 'retained-unrelated-provider');

    const unguardedEnvironment = { ...environment };
    delete unguardedEnvironment.DOTENV_CONFIG_PATH;
    const unguarded = runDotenvGrandchildProbe(rootDir, unguardedEnvironment);
    assert.equal(unguarded.CODEX_API_KEY, 'dotenv-codex-secret');
    assert.equal(unguarded.OPENAI_API_KEY, 'dotenv-openai-secret');
    assert.equal(unguarded.OPENAI_BASE_URL, 'https://dotenv-hostile.example/v1');
    assert.equal(unguarded.TUTOR_STUB_WARRANT_GATE, 'off');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('CLI contract fingerprints a no-model ChatGPT-account Codex route and rejects API/custom routes', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-codex-contract-'));
  try {
    const binDir = path.join(rootDir, 'bin');
    const executable = writeFakeCodex(binDir);
    const environment = {
      PATH: binDir,
      HOME: path.join(rootDir, 'home'),
      CODEX_HOME: path.join(rootDir, 'codex-home'),
      OPENROUTER_API_KEY: 'retained-unrelated-provider',
    };
    const cli = collectAdaptiveWarrantStudyCliContract({ environment });
    assert.equal(cli.executable.resolved_path, executable);
    assert.equal(cli.executable.realpath, fs.realpathSync(executable));
    assert.equal(cli.executable.sha256.length, 64);
    assert.equal(cli.executable.kind, 'direct_executable');
    assert.equal(cli.delegated_executable.resolution, 'direct_executable');
    assert.equal(cli.delegated_executable.same_as_entrypoint, true);
    assert.equal(cli.delegated_executable.sha256, cli.executable.sha256);
    assert.equal(cli.version, '9.9.9');
    assert.equal(cli.auth.route, 'chatgpt_account');
    assert.equal(cli.auth.verified, true);
    assert.equal(cli.model_calls, 0);
    assert.equal(cli.sha256.length, 64);

    const environmentContract = adaptiveWarrantStudyEnvironmentContract({ cliContract: cli });
    assert.equal(environmentContract.cli_contract_sha256, cli.sha256);
    assert.equal(environmentContract.sha256.length, 64);

    for (const [key, value] of [
      ['CODEX_API_KEY', 'codex-api-secret'],
      ['OPENAI_API_KEY', 'openai-api-secret'],
      ['OPENAI_BASE_URL', 'https://custom-openai.example/v1'],
    ]) {
      assert.throws(
        () => collectAdaptiveWarrantStudyCliContract({ environment: { ...environment, [key]: value } }),
        /rejected API-key\/custom-base-url environment/u,
      );
    }

    const apiRouteBin = path.join(rootDir, 'api-route-bin');
    writeFakeCodex(apiRouteBin, { auth: 'Logged in using API key' });
    assert.throws(
      () => collectAdaptiveWarrantStudyCliContract({ environment: { ...environment, PATH: apiRouteBin } }),
      /not authenticated through ChatGPT-account login/u,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('CLI contract binds an official wrapper to its delegated native executable', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-codex-supply-chain-'));
  try {
    const fixture = writeFakeOfficialCodexPackage(rootDir);
    const environment = {
      PATH: [fixture.binDir, process.env.PATH].filter(Boolean).join(path.delimiter),
      HOME: path.join(rootDir, 'home'),
      CODEX_HOME: path.join(rootDir, 'codex-home'),
    };
    const before = collectAdaptiveWarrantStudyCliContract({ environment });
    assert.equal(before.executable.resolved_path, fixture.command);
    assert.equal(before.executable.realpath, fs.realpathSync(fixture.wrapper));
    assert.equal(before.executable.kind, 'official_node_entrypoint');
    assert.equal(before.delegated_executable.realpath, fs.realpathSync(fixture.nativeExecutable));
    assert.equal(before.delegated_executable.resolution, 'official_platform_package');
    assert.equal(before.delegated_executable.same_as_entrypoint, false);
    assert.equal(before.delegated_executable.target_triple, fixture.targetTriple);
    assert.equal(before.delegated_executable.platform_package, fixture.platformPackage);

    const guardedEnvironment = {
      ...environment,
      ...adaptiveWarrantStudyCliGuardEnvironment(before),
    };
    const guarded = verifyAdaptiveWarrantStudyCliInvocation({ environment: guardedEnvironment });
    assert.equal(guarded.enabled, true);
    assert.equal(guarded.cli_contract_sha256, before.sha256);
    assert.equal(guarded.entrypoint_sha256, before.executable.sha256);
    assert.equal(guarded.delegated_executable_sha256, before.delegated_executable.sha256);

    fs.appendFileSync(fixture.nativeExecutable, '# supply-chain mutation with unchanged behavior\n');
    assert.throws(
      () => verifyAdaptiveWarrantStudyCliInvocation({ environment: guardedEnvironment }),
      /detected wrapper\/native\/package drift/u,
    );
    const priorEnvironment = Object.fromEntries(
      ['PATH', ...Object.keys(adaptiveWarrantStudyCliGuardEnvironment(before))].map((key) => [key, process.env[key]]),
    );
    Object.assign(process.env, guardedEnvironment);
    let modelSpawnCount = 0;
    try {
      await assert.rejects(
        () =>
          callAIWithCliBridge({ provider: 'codex', model: 'gpt-test' }, 'system', 'user', 'tutor', {
            spawnImpl: () => {
              modelSpawnCount += 1;
              throw new Error('model spawn must remain unreachable');
            },
          }),
        /detected wrapper\/native\/package drift/u,
      );
      assert.equal(modelSpawnCount, 0);
    } finally {
      for (const [key, value] of Object.entries(priorEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    const after = collectAdaptiveWarrantStudyCliContract({ environment });
    assert.equal(after.executable.sha256, before.executable.sha256);
    assert.notEqual(after.delegated_executable.sha256, before.delegated_executable.sha256);
    assert.notEqual(after.sha256, before.sha256);
    assert.notEqual(
      adaptiveWarrantStudyEnvironmentContract({ cliContract: after }).sha256,
      adaptiveWarrantStudyEnvironmentContract({ cliContract: before }).sha256,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('stable decision comparison catches every formerly omitted typed decision surface', () => {
  const expected = decisionFixture();
  const projection = projectStableAdaptiveWarrantDecision(expected);
  assert.equal(
    projection.public_obligation.speech_act.target.signature,
    expected.public_obligation.speech_act.target.signature,
  );
  assert.equal(projection.inquiry_completion.conclusion_kind, null);
  assert.equal(projection.policy.rationale, expected.policy.rationale);
  assert.deepEqual(projection.obligation_directive, expected.obligation_directive);
  assert.deepEqual(projection.override, expected.override);
  assert.equal(compareStableAdaptiveWarrantDecisions(expected, structuredClone(expected)).ok, true);

  const mutations = [
    [
      'speech target',
      (row) => (row.public_obligation.speech_act.target.signature = 'different-target'),
      '/public_obligation/speech_act/target/signature',
    ],
    [
      'obligation lifecycle',
      (row) => (row.public_obligation.obligations[0].response_due_turn = 9),
      '/public_obligation/obligations/0/response_due_turn',
    ],
    [
      'completion transition',
      (row) => (row.inquiry_completion.transition = { kind: 'terminal_transition' }),
      '/inquiry_completion/transition',
    ],
    [
      'completion conclusion',
      (row) => (row.inquiry_completion.conclusion_kind = 'answer'),
      '/inquiry_completion/conclusion_kind',
    ],
    ['full policy', (row) => (row.policy.rationale = 'different rationale'), '/policy/rationale'],
    [
      'obligation directive',
      (row) => row.obligation_directive.acceptable_outcomes.pop(),
      '/obligation_directive/acceptable_outcomes/length',
    ],
    ['override', (row) => (row.override.reason = 'different reason'), '/override/reason'],
  ];
  for (const [label, mutate, mismatch] of mutations) {
    const observed = structuredClone(expected);
    mutate(observed);
    const comparison = compareStableAdaptiveWarrantDecisions(expected, observed);
    assert.equal(comparison.ok, false, label);
    assert.ok(comparison.mismatches.includes(mismatch), `${label}: ${comparison.mismatches.join(', ')}`);
  }

  const replayPresentation = {
    ...structuredClone(expected),
    verdict: 'aligned_hold',
    actual_selection: { extra: true },
  };
  assert.equal(compareStableAdaptiveWarrantDecisions(expected, replayPresentation).ok, true);
});

test('runtime resource collector includes provider routing, tutor registry, and selected role prompt', () => {
  const resources = collectAdaptiveWarrantStudyRuntimeResourcePaths({ repoRoot: ROOT });
  assert.deepEqual(resources, [
    'config/adaptive-warrant-study.env',
    'config/providers.yaml',
    'config/tutor-instances.yaml',
    'prompts/tutors/dramatic-detective.md',
  ]);
});

test('child evidence verification fails closed for missing seals and sealed-artifact tampering', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-child-evidence-'));
  try {
    const validDir = path.join(rootDir, 'valid-child');
    createSealedChild(validDir, { parentRunId: 'parent-study' });
    const expectedPolicySha256 = experimentHashes().policy;
    const valid = verifyAdaptiveWarrantStudyChildEvidence({
      runDir: validDir,
      expectedRunId: 'valid-child',
      expectedParentRunId: 'parent-study',
      expectedGitSha: '0123456789abcdef',
      expectedGitDirty: false,
      expectedPolicySha256,
    });
    assert.equal(valid.ok, true, valid.errors.join('\n'));
    assert.equal(valid.plan_sha256.length, 64);
    assert.equal(valid.seal_sha256.length, 64);

    const wrongGitSha = verifyAdaptiveWarrantStudyChildEvidence({
      runDir: validDir,
      expectedGitSha: 'fedcba9876543210',
    });
    assert.equal(wrongGitSha.ok, false);
    assert.ok(
      wrongGitSha.errors.some((error) => /child git sha/u.test(error)),
      wrongGitSha.errors.join('\n'),
    );

    const wrongGitDirty = verifyAdaptiveWarrantStudyChildEvidence({
      runDir: validDir,
      expectedGitDirty: true,
    });
    assert.equal(wrongGitDirty.ok, false);
    assert.ok(
      wrongGitDirty.errors.some((error) => /child git dirty state/u.test(error)),
      wrongGitDirty.errors.join('\n'),
    );

    const wrongPolicy = verifyAdaptiveWarrantStudyChildEvidence({
      runDir: validDir,
      expectedPolicySha256: 'f'.repeat(64),
    });
    assert.equal(wrongPolicy.ok, false);
    assert.ok(
      wrongPolicy.errors.some((error) => /child policy sha256/u.test(error)),
      wrongPolicy.errors.join('\n'),
    );

    fs.appendFileSync(path.join(validDir, 'trace.jsonl'), '{"tampered":true}\n');
    const tampered = verifyAdaptiveWarrantStudyChildEvidence({
      runDir: validDir,
      expectedRunId: 'valid-child',
      expectedParentRunId: 'parent-study',
    });
    assert.equal(tampered.ok, false);
    assert.ok(
      tampered.errors.some((error) => /checksum mismatch/u.test(error)),
      tampered.errors.join('\n'),
    );

    const missingSealDir = path.join(rootDir, 'missing-seal');
    const plan = buildExperimentRunPlan({
      runId: 'missing-seal',
      createdAt: '2026-08-10T00:00:00.000Z',
      runner: 'scripts/run-tutor-stub-auto-eval.js',
      provenance: {
        git: {
          sha: '0123456789abcdef',
          branch: 'adaptation-refinement',
          dirty: false,
          fingerprintSha256: hashCanonicalJson({ clean: true }),
        },
      },
      models: { tutor: { requested: 'mock.tutor', resolved: 'mock.tutor' } },
      requiredObservedModelRoles: [],
      hashes: experimentHashes(),
      masterSeed: 401,
      jobs: [{ id: 'dynamic-r1', profile: 'diligent', policy: 'dynamic', repeat: 1 }],
      lineage: { parentRunId: 'parent-study', resumeOf: null, supersedes: [] },
    });
    createRunPlan(missingSealDir, plan);
    appendRunEvent(missingSealDir, { type: 'run_started', recordedAt: '2026-08-10T00:00:01.000Z' });
    const missing = verifyAdaptiveWarrantStudyChildEvidence({ runDir: missingSealDir });
    assert.equal(missing.ok, false);
    assert.ok(
      missing.errors.some((error) => /missing run-seal\.json/u.test(error)),
      missing.errors.join('\n'),
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
