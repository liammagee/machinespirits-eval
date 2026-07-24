import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { callExternalModelCliText, createModelCliLaunchPlan, spawnModelCliProcess } from '../modelCliProcessPolicy.js';
import { checkModelCliLaunchManifest } from '../../scripts/check-model-cli-launches.js';

const SECRET_SOURCE_ENV = {
  PATH: '/safe/bin',
  HOME: '/safe/home',
  LANG: 'en_AU.UTF-8',
  CLAUDE_CODE_OAUTH_TOKEN: 'claude-selected-token',
  OPENAI_API_KEY: 'codex-selected-token',
  GEMINI_API_KEY: 'gemini-secret-canary',
  OPENROUTER_API_KEY: 'openrouter-secret-canary',
  ANTHROPIC_API_KEY: 'anthropic-secret-canary',
  NODE_OPTIONS: '--require=/tmp/secret-canary.cjs',
};

function fakeChild({ code = 0, stdout = '', stderr = '' } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  child.stdin = {
    write() {},
    end() {
      queueMicrotask(() => {
        if (stdout) child.stdout.write(stdout);
        if (stderr) child.stderr.write(stderr);
        child.stdout.end();
        child.stderr.end();
        child.emit('close', code);
      });
    },
  };
  return child;
}

describe('modelCliProcessPolicy', () => {
  it('gives each retained launch class an explicit least-privilege policy and provider-only environment', () => {
    const cases = [
      {
        provider: 'claude-code',
        mode: 'persistent-text',
        args: ['-p', '--input-format', 'stream-json'],
        allowTools: false,
        selectedKey: 'CLAUDE_CODE_OAUTH_TOKEN',
        isolated: true,
      },
      {
        provider: 'codex',
        mode: 'interactive-user-authorized',
        args: [],
        allowTools: true,
        selectedKey: 'OPENAI_API_KEY',
        isolated: false,
      },
      {
        provider: 'codex',
        mode: 'agentic-batch-user-authorized',
        args: ['exec', '-'],
        allowTools: true,
        selectedKey: 'OPENAI_API_KEY',
        isolated: false,
      },
      {
        provider: 'agy',
        mode: 'one-shot-external',
        args: ['--print'],
        allowTools: false,
        selectedKey: null,
        isolated: true,
      },
      {
        provider: 'ollama',
        mode: 'one-shot-external',
        args: ['run', 'fixture'],
        allowTools: false,
        selectedKey: null,
        isolated: true,
      },
    ];

    for (const fixture of cases) {
      const plan = createModelCliLaunchPlan({
        ...fixture,
        cwd: process.cwd(),
        sourceEnv: SECRET_SOURCE_ENV,
      });
      try {
        assert.equal(plan.policy.mode, fixture.mode);
        assert.equal(plan.policy.environment, 'provider-allowlist');
        assert.equal(
          plan.policy.cwdIsolation,
          fixture.isolated ? 'fresh-temporary-directory' : 'explicit-caller-directory',
        );
        if (fixture.selectedKey) assert.ok(plan.env[fixture.selectedKey]);
        for (const key of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'NODE_OPTIONS']) {
          assert.equal(plan.env[key], undefined, `${fixture.mode} must not receive ${key}`);
        }
        if (fixture.provider !== 'gemini-cli') assert.equal(plan.env.GEMINI_API_KEY, undefined);
        if (fixture.provider === 'claude-code') {
          assert.ok(plan.args.includes('--safe-mode'));
          assert.ok(plan.args.includes('--tools'));
        }
        if (fixture.provider === 'agy') assert.ok(plan.args.includes('--sandbox'));
      } finally {
        const cwd = plan.cwd;
        plan.cleanup();
        if (fixture.isolated) assert.equal(fs.existsSync(cwd), false);
      }
    }
  });

  it('requires explicit tool authorization and rejects arbitrary environment overrides', () => {
    assert.throws(
      () => createModelCliLaunchPlan({ provider: 'codex', mode: 'interactive-user-authorized' }),
      /requires explicit allowTools/,
    );
    assert.throws(
      () =>
        createModelCliLaunchPlan({
          provider: 'codex',
          mode: 'interactive-user-authorized',
          allowTools: true,
          envOverrides: { UNRELATED_SECRET: 'canary' },
        }),
      /is not allowed/,
    );
    assert.throws(
      () =>
        createModelCliLaunchPlan({
          provider: 'agy',
          mode: 'one-shot-external',
          args: ['--dangerously-skip-permissions'],
        }),
      /cannot bypass tool permissions/,
    );
  });

  it('redacts child output, prompts, and commands from external-model failures', async () => {
    const secret = 'raw-model-secret-canary';
    await assert.rejects(
      () =>
        callExternalModelCliText({
          provider: 'agy',
          args: ['--print'],
          prompt: `prompt-${secret}`,
          spawnImpl: () => fakeChild({ code: 7, stdout: `stdout-${secret}`, stderr: `stderr-${secret}` }),
        }),
      (error) => {
        assert.equal(error.code, 'MODEL_CLI_EXIT_FAILED');
        assert.doesNotMatch(error.message, new RegExp(secret, 'u'));
        assert.doesNotMatch(error.message, /--print/u);
        assert.equal(error.stdoutBytes > 0, true);
        assert.equal(error.stderrBytes > 0, true);
        return true;
      },
    );
  });

  it('cleans isolated persistent launches after child exit', () => {
    const child = fakeChild();
    const launch = spawnModelCliProcess({
      provider: 'claude-code',
      mode: 'persistent-text',
      args: ['-p'],
      spawnImpl: () => child,
    });
    const cwd = child.spawnargs?.cwd || null;
    child.emit('close', 0);
    launch.cleanup();
    assert.equal(launch.policy.mode, 'persistent-text');
    if (cwd) assert.equal(fs.existsSync(cwd), false);
  });

  it('keeps the checked repository launch inventory complete', () => {
    const result = checkModelCliLaunchManifest();
    assert.deepEqual(result.manifestErrors, []);
    assert.deepEqual(result.unclassified, []);
    assert.equal(result.candidates.length, 7);
    assert.equal(result.launchCount, 5);
  });
});
