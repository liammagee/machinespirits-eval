/**
 * LLM client for the dramatic-derivation role bridges — the mock/real seam
 * (same discipline as services/adaptiveTutor/llm.js: default is mock so
 * smokes, tests, and plumbing iterations cost nothing; DERIVATION_LLM=real
 * routes through tutor-core's unifiedAIProvider with providers.yaml alias
 * resolution, or through a local CLI for quota-billed providers).
 *
 *   DERIVATION_LLM       mock (default) | real
 *   DERIVATION_PROVIDER  provider name (default: openrouter). 'codex' routes
 *                        through the local codex CLI (`codex exec`), 'claude'
 *                        through the local claude CLI (`claude -p`) — both
 *                        plan quota, not metered; neither reports token usage.
 *   DERIVATION_MODEL     model alias or id (default: gemini-flash — the
 *                        plan's cheap-default cost discipline, §3 step 5).
 *                        For 'codex' it is optional (-m); unset = the CLI's
 *                        own configured default model.
 *
 * Per-role overrides (six-role ready — director, tutor, learner now; the two
 * superegos later): DERIVATION_<ROLE>_PROVIDER / DERIVATION_<ROLE>_MODEL,
 * role name uppercased with non-alphanumerics → '_', falling back to the
 * shared pair above. E.g. DERIVATION_LEARNER_MODEL=gpt-5.2,
 * DERIVATION_TUTOR_SUPEREGO_PROVIDER=codex.
 *
 *   DERIVATION_CODEX_REASONING  reasoning effort for codex CLI calls
 *                        (default: medium — drama turns are short; the user
 *                        config's interactive default may be far heavier).
 *                        Set to 'config' to inherit ~/.codex/config.toml.
 *
 * The mock backend answers from the bridge-supplied `meta` hints through the
 * SAME parse path the real backend uses, so llmRoles' prompt → JSON → output
 * plumbing is exercised end-to-end with zero model calls. Per-client usage
 * (calls, tokens, synthesized cost) is accumulated for the loop ledger,
 * total and per role.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unifiedAIProvider } from '../../tutor-core/index.js';
import { getProviderConfig } from '../learnerConfigLoader.js';
import { lookupRates } from '../adaptiveTutor/budgetTracker.js';

const DEFAULT_PROVIDER = 'openrouter';
const DEFAULT_MODEL_ALIAS = 'gemini-flash';
const CLI_PROVIDERS = new Set(['codex', 'claude']);
const CLI_TIMEOUT_MS = 360_000;
const DEFAULT_CODEX_REASONING = 'medium';

export function llmMode() {
  return (process.env.DERIVATION_LLM || 'mock').toLowerCase();
}

function roleEnv(role, suffix) {
  if (role) {
    const key = `DERIVATION_${String(role)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')}_${suffix}`;
    if (process.env[key]) return process.env[key];
  }
  return process.env[`DERIVATION_${suffix}`];
}

/**
 * Resolve the provider/model pair for a role (or the shared default when no
 * role is given). CLI providers carry `cli: true` and a nullable model
 * (null = the CLI's own configured default).
 */
export function resolveTarget(role = null) {
  const provider = roleEnv(role, 'PROVIDER') || DEFAULT_PROVIDER;
  if (CLI_PROVIDERS.has(provider)) {
    return { provider, model: roleEnv(role, 'MODEL') || null, cli: true };
  }
  const alias = roleEnv(role, 'MODEL') || DEFAULT_MODEL_ALIAS;
  let model = alias;
  try {
    const cfg = getProviderConfig(provider);
    model = cfg?.models?.[alias] || alias;
  } catch {
    /* unknown provider in config — pass alias through, the call will say so */
  }
  return { provider, model };
}

const NON_RETRYABLE = [
  /\b40[013]\b/,
  /unauthorized/i,
  /forbidden/i,
  /invalid[_ ]api[_ ]key/i,
  /no API key/i,
  /ENOENT/,
  /not logged in/i,
];

// Neutral working dir for CLI calls: keeps the repo's AGENTS.md (developer
// instructions) out of the drama roles' context, and hosts the per-call
// last-message files.
let cliWorkDir = null;
let cliCallSeq = 0;
function ensureCliWorkDir() {
  if (!cliWorkDir) cliWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-cli-'));
  return cliWorkDir;
}

/**
 * One atomic `codex exec` call (the repo's proven judge pattern: prompt on
 * stdin, no session state). codex has no system-prompt flag, so system + user
 * fold into a single stdin payload; the role contract's "reply with ONLY the
 * JSON object" plus llmRoles' fence-then-brace parse absorb any chatter.
 */
function callCodexCli(system, user, model) {
  const workDir = ensureCliWorkDir();
  cliCallSeq += 1;
  const outFile = path.join(workDir, `last-message-${cliCallSeq}.txt`);
  const args = ['exec', '-', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-o', outFile];
  const reasoning = process.env.DERIVATION_CODEX_REASONING || DEFAULT_CODEX_REASONING;
  if (reasoning !== 'config') args.push('-c', `model_reasoning_effort="${reasoning}"`);
  if (model) args.push('-m', model);
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd: workDir,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`codex CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(reject, new Error(`codex CLI spawn failed: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`codex CLI exited ${code}: ${(stderr || stdout).slice(-500)}`));
        return;
      }
      let content = '';
      try {
        content = fs.readFileSync(outFile, 'utf8');
        fs.rmSync(outFile, { force: true });
      } catch {
        /* fall through to stdout scrape */
      }
      if (!content.trim()) content = stdout;
      const banner = `${stdout}\n${stderr}`.match(/^\s*model:\s*(\S+)/m);
      finish(resolve, {
        content,
        model: model || (banner ? banner[1] : 'codex-default'),
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
      });
    });
    child.stdin.write(`${system}\n\n=== TURN INPUT ===\n\n${user}`);
    child.stdin.end();
  });
}

/**
 * One atomic `claude -p` call (the pattern proven in adaptiveTutor/realLLM.js
 * and rubricEvaluator.js). --system-prompt REPLACES the CLI's default system
 * prompt — which both separates system from user cleanly and suppresses any
 * ambient output-style additions that would corrupt the JSON parse. The child
 * env must drop the API/session vars or the CLI silently bills the metered
 * API instead of the Max-plan quota window.
 */
function callClaudeCli(system, user, model) {
  const args = ['-p', '-', '--output-format', 'text', '--system-prompt', system];
  if (model) args.push('--model', model);
  const env = { ...process.env };
  delete env.CLAUDE_CODE;
  delete env.CLAUDECODE;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: ensureCliWorkDir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(reject, new Error(`claude CLI spawn failed: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`claude CLI exited ${code}: ${(stderr || stdout).slice(-500)}`));
        return;
      }
      finish(resolve, {
        content: stdout.trim(),
        model: model || 'claude-default',
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
      });
    });
    child.stdin.write(user);
    child.stdin.end();
  });
}

function mockResponse(role, meta = {}) {
  if (role === 'director') {
    return JSON.stringify({
      direction: meta.releaseSurface
        ? `[It comes before the room: ${meta.releaseSurface}]`
        : `[The question holds the stage: ${meta.question || ''}]`,
      // Exercise the free-dramaturgy channels deterministically: declare a
      // movement (and conduct the tutor) wherever the author's sketch turns.
      phase: meta.phaseHint ? { name: meta.phaseHint.title, intent: meta.phaseHint.intent || 'as sketched' } : null,
      tutor_note: meta.phaseHint ? `New movement — ${meta.phaseHint.title}. Let the rhythm change.` : null,
    });
  }
  if (role === 'tutor') {
    return JSON.stringify({
      dialogue: meta.releaseSurface
        ? `Consider what is now before you: ${meta.releaseSurface} What does it do to what you already hold?`
        : 'Hold what you have against the rules you trust. What follows, and what is still missing?',
      move: {
        figure: 'erotema',
        target_premise: meta.cuePremise || null,
        intent: meta.cuePremise ? 'release' : 'consolidate',
      },
    });
  }
  if (role === 'learner') {
    const adoptAll = Array.from({ length: meta.adoptableCount || 0 }, (_, i) => i);
    return JSON.stringify({
      dialogue: meta.patternAssertion
        ? `Then it is shown: ${meta.patternAssertion.surface}.`
        : adoptAll.length
          ? 'I take what has been shown and set it beside the rest.'
          : 'I am listening; nothing new is on the table.',
      adopt_indices: adoptAll,
      retract_indices: [],
      hypothesis: meta.patternAssertion ? null : adoptAll.length ? 'weighing what this changes' : null,
      asserts_binding: meta.patternAssertion ? meta.patternAssertion.binding : null,
    });
  }
  throw new Error(`derivation.llmClient: unknown mock role '${role}'`);
}

/**
 * @returns {{ call(role, {system, user, meta}) => Promise<string>,
 *             usage() => {calls, inputTokens, outputTokens, costUSD, byRole},
 *             mode: string }}
 */
export function makeLlmClient({ mode = llmMode(), temperature = 0.7, maxTokens = 600 } = {}) {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0, byRole: {} };

  function ledgerFor(role) {
    if (!usage.byRole[role]) usage.byRole[role] = { calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 };
    return usage.byRole[role];
  }

  async function callOnce(system, user, target) {
    if (target.cli) {
      if (target.provider === 'codex') return callCodexCli(system, user, target.model);
      if (target.provider === 'claude') return callClaudeCli(system, user, target.model);
      throw new Error(`derivation.llmClient: no CLI bridge for provider '${target.provider}'`);
    }
    return unifiedAIProvider.call({
      provider: target.provider,
      model: target.model,
      systemPrompt: system,
      messages: [{ role: 'user', content: user }],
      preset: 'direct',
      config: { temperature, maxTokens },
    });
  }

  async function call(role, { system, user, meta }) {
    usage.calls += 1;
    const ledger = ledgerFor(role);
    ledger.calls += 1;
    if (mode === 'mock') return mockResponse(role, meta);
    if (mode !== 'real') {
      throw new Error(`derivation.llmClient: unknown DERIVATION_LLM mode '${mode}' (expected 'mock' or 'real')`);
    }
    const target = resolveTarget(role);
    const trace = process.env.DERIVATION_TRACE === '1';
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const startedAt = Date.now();
      if (trace) {
        process.stderr.write(
          `    … ${role} → ${target.provider}/${target.model || 'default'}${attempt > 1 ? ` (attempt ${attempt})` : ''}\n`,
        );
      }
      try {
        const response = await callOnce(system, user, target);
        if (trace) process.stderr.write(`      ${role} done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
        const inputTokens = response.usage?.inputTokens || 0;
        const outputTokens = response.usage?.outputTokens || 0;
        let cost = response.usage?.cost || 0;
        if (cost === 0 && (inputTokens > 0 || outputTokens > 0)) {
          const [inRate, outRate] = lookupRates(response.model || target.model);
          cost = (inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate;
        }
        usage.inputTokens += inputTokens;
        usage.outputTokens += outputTokens;
        usage.costUSD += cost;
        ledger.inputTokens += inputTokens;
        ledger.outputTokens += outputTokens;
        ledger.costUSD += cost;
        return response.content || '';
      } catch (err) {
        lastErr = err;
        const msg = err?.message || String(err);
        if (trace) {
          process.stderr.write(
            `      ${role} FAILED after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${msg.slice(0, 120)}\n`,
          );
        }
        if (attempt === 3 || NON_RETRYABLE.some((re) => re.test(msg))) throw err;
        await new Promise((r) => setTimeout(r, attempt * 750));
      }
    }
    throw lastErr;
  }

  return {
    call,
    usage: () => ({
      ...usage,
      byRole: Object.fromEntries(Object.entries(usage.byRole).map(([k, v]) => [k, { ...v }])),
    }),
    mode,
  };
}
