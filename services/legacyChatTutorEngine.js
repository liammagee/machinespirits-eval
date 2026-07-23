import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import * as evalConfigLoader from './evalConfigLoader.js';
import { extractTutorMessage } from './learnerTutorInteractionEngine.js';
import { buildCurriculumPromptBlock, buildDirectorPromptBlock } from './legacyChatCurriculum.js';
import { loadPromptFile } from './legacyChatPromptLoader.js';

const INTERFACE_AFFORDANCE = `==============================
INTERFACE CONSTRAINTS (read carefully)
==============================
You are speaking in a plain-text chat. Your reply is rendered as text with inline
math only. You CANNOT display interactive simulations, animations, applets,
sliders, graphs, videos, or images — there is no canvas the learner can watch.
Never tell the learner to "watch the simulation", "see the animation", "drag the
slider", or refer to any visual the interface cannot actually show; promising a
visual you can't render is worse than not mentioning one. Instead make the idea
concrete in text: worked numeric examples, step-by-step reasoning, and small
figures drawn with characters (e.g. a number line 0 --|--|--|-- 1, or 3/8 as
[##....] ) when a picture would help.`;

function recentContext(history) {
  return (history || [])
    .slice(-6)
    .map((m) => `${(m.role || 'unknown').toUpperCase()}: ${m.content || ''}`)
    .join('\n\n');
}

// Alternative backend: spawn the local `claude` CLI (non-interactive -p mode) so
// a user can test their chat architectures against Claude Opus 4.7 without
// touching any eval config or adding an API key. Same return shape as callModel
// so runTutorTurn can swap transparently.
const CLAUDE_CLI_BIN = process.env.CLAUDE_CLI_BIN || 'claude';
const CLAUDE_CLI_MODEL = process.env.CHAT_CLI_MODEL || 'claude-opus-4-7';
const CLAUDE_CLI_TIMEOUT_MS = Number(process.env.CHAT_CLI_TIMEOUT_MS) || 180_000;
const CODEX_CLI_BIN = process.env.CODEX_CLI_BIN || 'codex';
// No hardcoded codex default: ChatGPT-account codex rejects models outside its
// entitlement, so unless the user (or CHAT_CODEX_MODEL) names one we omit -m
// and let ~/.codex/config.toml decide.
const CODEX_CLI_MODEL = process.env.CHAT_CODEX_MODEL || null;
const CLI_PROVIDERS = ['claude', 'codex'];
const CLI_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'];

// Normalize the substrate request: new-style { cli: { provider, model, effort } }
// with the legacy boolean useClaudeCli mapping to { provider: 'claude' }.
// model is a free string (validated only for shape); effort must be a known level.
export function normalizeCli(body = {}) {
  const raw = body.cli && typeof body.cli === 'object' ? body.cli : {};
  let provider = CLI_PROVIDERS.includes(raw.provider) ? raw.provider : null;
  if (!provider && body.useClaudeCli === true) provider = 'claude';
  if (!provider) return { provider: null, model: null, effort: null };
  const model =
    typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim().slice(0, 80).replace(/["\\]/g, '') : null;
  const effort = CLI_EFFORTS.includes(raw.effort) ? raw.effort : null;
  return { provider, model, effort };
}

export function cliModelLabel(cli) {
  if (!cli?.provider) return null;
  if (cli.provider === 'codex') return cli.model || CODEX_CLI_MODEL || 'codex-config-default';
  return cli.model || CLAUDE_CLI_MODEL;
}

// Dispatch a pure text-generation call to the requested local CLI substrate.
export function callCli(cli, { system, user }) {
  if (cli?.provider === 'codex') {
    return callCodexCli({ system, user, model: cli.model, effort: cli.effort });
  }
  return callClaudeCli({ system, user, model: cli?.model || null, effort: cli?.effort || null });
}

async function callClaudeCli({ system, user, model = null, effort = null }) {
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const start = Date.now();
  // Note: we do NOT pass --bare because that disables keychain auth (the user's
  // Claude subscription). We disable all tools so the ego/superego stay pure
  // text generators, and --no-session-persistence keeps the CLI from polluting
  // the resume history with chat turns.
  const args = [
    '-p',
    fullPrompt,
    '--model',
    model || CLAUDE_CLI_MODEL,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--disallowedTools',
    'Bash,Edit,Write,Read,Grep,Glob,WebFetch,WebSearch,Task,NotebookEdit,AskUserQuestion',
  ];
  if (effort) args.push('--effort', effort);
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_CLI_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* already exited */
      }
      reject(new Error(`claude CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (code !== 0) {
        return reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 400)}`));
      }
      // --output-format json emits an array of stream events. Find the final
      // {type:"result", subtype:"success"} entry and read its .result field.
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let costUsd = 0;
      try {
        const payload = JSON.parse(stdout.trim());
        if (Array.isArray(payload)) {
          const resultEvent = [...payload].reverse().find((e) => e?.type === 'result');
          if (resultEvent) {
            if (resultEvent.is_error) {
              return reject(new Error(`claude CLI error: ${resultEvent.result || 'unknown'}`));
            }
            content = String(resultEvent.result || '').trim();
            inputTokens = resultEvent.usage?.input_tokens || 0;
            outputTokens = resultEvent.usage?.output_tokens || 0;
            costUsd = resultEvent.total_cost_usd || 0;
          }
        } else {
          // single-object format (fallback)
          content = String(payload.result ?? payload.text ?? payload.content ?? '').trim();
          inputTokens = payload.usage?.input_tokens || 0;
          outputTokens = payload.usage?.output_tokens || 0;
        }
      } catch {
        content = stdout.trim();
      }
      if (!inputTokens) inputTokens = Math.ceil(fullPrompt.length / 4);
      if (!outputTokens) outputTokens = Math.ceil(content.length / 4);
      resolve({ content, latencyMs, inputTokens, outputTokens, costUsd });
    });
  });
}

// Codex CLI substrate: `codex exec` as a pure text generator. read-only
// sandbox + --skip-git-repo-check keep it from acting like an agent; the
// final assistant message is written to a temp file via -o (stable across
// codex versions, unlike the JSONL event stream). Token counts are estimated
// (subscription-billed; codex does not report usage through -o).
async function callCodexCli({ system, user, model = null, effort = null }) {
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const start = Date.now();
  const outFile = path.join(
    fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ms-chat-codex-')),
    'last-message.txt',
  );
  const args = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never', '-o', outFile];
  const chosenModel = model || CODEX_CLI_MODEL;
  if (chosenModel) args.push('-m', chosenModel);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  args.push(fullPrompt);
  return new Promise((resolve, reject) => {
    const proc = spawn(CODEX_CLI_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const cleanup = () => {
      try {
        fs.rmSync(path.dirname(outFile), { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    };
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* already exited */
      }
      cleanup();
      reject(new Error(`codex CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      let content = '';
      try {
        content = fs.readFileSync(outFile, 'utf8').trim();
      } catch {
        content = '';
      }
      cleanup();
      if (code !== 0) {
        return reject(new Error(`codex CLI exited ${code}: ${stderr.slice(0, 400)}`));
      }
      if (!content) {
        return reject(new Error(`codex CLI returned no output: ${stderr.slice(0, 400)}`));
      }
      resolve({
        content,
        latencyMs,
        inputTokens: Math.ceil(fullPrompt.length / 4),
        outputTokens: Math.ceil(content.length / 4),
        costUsd: 0,
      });
    });
  });
}

export async function callModel(apiKey, { modelId, system, user, temperature, maxTokens }) {
  const start = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:8081/chat',
      'X-Title': 'Machine Spirits Chat',
    },
    body: JSON.stringify({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const latencyMs = Date.now() - start;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '';
  return {
    content,
    latencyMs,
    inputTokens: payload.usage?.prompt_tokens || 0,
    outputTokens: payload.usage?.completion_tokens || 0,
  };
}

// Streaming single-agent path: only the ego call, OpenRouter `stream: true`,
// each delta forwarded via `onDelta` callback. Returns the same shape as a
// single-agent runTutorTurn would, so the caller can persist identically.
//
// Multi-agent cells (with superego) intentionally fall through to the
// non-streaming runTutorTurn — we'd have to buffer the ego output for the
// superego review anyway, defeating the streaming benefit.
export async function streamSingleAgentTurn({
  profile,
  apiKey,
  history,
  learnerMessage,
  topic,
  curriculum = null,
  directorPlan = null,
  egoModelOverride = null,
  temperature = null,
  maxTokens = null,
  onDelta,
}) {
  const conversationContext = recentContext(history);
  const egoModelRef = egoModelOverride || evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = temperature ?? profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = maxTokens ?? profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = buildCurriculumPromptBlock(curriculum);
  const directorBlock = buildDirectorPromptBlock(directorPlan);

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner just said:
"${learnerMessage}"

Draft your initial response as a tutor. Be warm but intellectually challenging. Don't be condescending. Build on their words. Provide ONLY the response text (no JSON, no meta-commentary).`;

  const start = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:8081/chat',
      'X-Title': 'Machine Spirits Chat (streaming)',
    },
    body: JSON.stringify({
      model: egoModelRef.model,
      temperature: egoTemp,
      max_tokens: egoMaxTokens,
      stream: true,
      messages: [
        { role: 'system', content: egoSystem },
        { role: 'user', content: learnerMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // partial last line stays in buffer
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]' || !data) continue;
      try {
        const obj = JSON.parse(data);
        const delta = obj.choices?.[0]?.delta?.content || '';
        if (delta) {
          accumulated += delta;
          if (typeof onDelta === 'function') onDelta(delta);
        }
        if (obj.usage) {
          inputTokens = obj.usage.prompt_tokens || inputTokens;
          outputTokens = obj.usage.completion_tokens || outputTokens;
        }
      } catch {
        // partial chunk; safe to skip — line will reassemble next loop
      }
    }
  }
  const latencyMs = Date.now() - start;
  if (!inputTokens) inputTokens = Math.ceil((egoSystem + learnerMessage).length / 4);
  if (!outputTokens) outputTokens = Math.ceil(accumulated.length / 4);

  return {
    finalMessage: accumulated,
    egoModel: egoModelRef.model,
    egoProvider: egoModelRef.provider,
    inputTokens,
    outputTokens,
    latencyMs,
    deliberation: [
      {
        role: 'ego',
        label: 'Ego — initial draft',
        content: accumulated,
        model: egoModelRef.model,
        provider: egoModelRef.provider,
        temperature: egoTemp,
        latencyMs,
        inputTokens,
        outputTokens,
      },
    ],
  };
}

export async function runTutorTurn({
  profile,
  apiKey,
  history,
  learnerMessage,
  topic,
  curriculum = null,
  directorPlan = null,
  useClaudeCli = false,
  cli = null,
  instigate = false,
  // Optional, live-only knobs. Defaults preserve the scored instrument exactly:
  // styleDirective is appended to the ego draft + superego revision instructions
  // (e.g. a brevity / one-question-per-turn rule for the interactive sit-in), and
  // maxTokens caps the ego/superego output. Batch eval never sets either.
  styleDirective = '',
  maxTokens = null,
  temperature = null,
  egoModelOverride = null,
  superegoModelOverride = null,
}) {
  const conversationContext = recentContext(history);
  const deliberation = [];
  const styleLine = styleDirective ? `\n\n${styleDirective}` : '';
  // CLI substrate config: explicit `cli` wins; legacy useClaudeCli maps to claude.
  const cliCfg = cli?.provider ? cli : useClaudeCli ? { provider: 'claude', model: null, effort: null } : null;

  const egoModelRef = egoModelOverride || evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = temperature ?? profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = maxTokens ?? profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = buildCurriculumPromptBlock(curriculum);
  const directorBlock = buildDirectorPromptBlock(directorPlan);

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

${
  instigate
    ? `The curtain has just risen: there is no learner line yet. You speak first. Open the scene — set the stage per the director frame, welcome the learner in character, and pose one inviting opening move on the topic. Keep it short enough to answer.`
    : `The learner just said:
"${learnerMessage}"

Draft your initial response as a tutor. Be warm but intellectually challenging. Don't be condescending. Build on their words.`
}${styleLine} Provide ONLY the response text (no JSON, no meta-commentary).`;

  const egoUser = instigate ? 'Open the scene now.' : learnerMessage;
  const egoOut = cliCfg
    ? await callCli(cliCfg, { system: egoSystem, user: egoUser })
    : await callModel(apiKey, {
        modelId: egoModelRef.model,
        system: egoSystem,
        user: egoUser,
        temperature: egoTemp,
        maxTokens: egoMaxTokens,
      });

  const egoDraft = egoOut.content;
  deliberation.push({
    role: 'ego',
    label: 'Ego — initial draft',
    content: egoDraft,
    model: cliCfg ? cliModelLabel(cliCfg) : egoModelRef.model,
    provider: cliCfg ? `${cliCfg.provider}-cli` : egoModelRef.provider,
    temperature: egoTemp,
    latencyMs: egoOut.latencyMs,
    inputTokens: egoOut.inputTokens,
    outputTokens: egoOut.outputTokens,
    costUsd: egoOut.costUsd || 0,
  });

  let finalMessage = egoDraft;
  let superegoCritique = null;
  let wasRevised = false;

  if (profile.superego) {
    const superModelRef =
      superegoModelOverride || evalConfigLoader.resolveModel(`${profile.superego.provider}.${profile.superego.model}`);
    const superPromptBody = loadPromptFile(profile.superego.prompt_file);
    const superTemp = profile.superego.hyperparameters?.temperature ?? 0.2;
    const superMaxTokens = maxTokens ?? profile.superego.hyperparameters?.max_tokens ?? 2000;

    const superSystem = `${superPromptBody || 'You are a pedagogical critic reviewing tutor responses.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner said:
"${learnerMessage}"

The tutor's DRAFT response:
"${egoDraft}"

Critique this draft for pedagogical soundness, emotional attunement, Socratic quality, and ZPD awareness. Then provide an improved version (or write "APPROVED" if the draft is already strong).${styleLine ? `\n\nThe improved version MUST also obey:${styleLine}` : ''}

Format strictly:
CRITIQUE: [your analysis]
IMPROVED: [refined response, or "APPROVED"]`;

    const superOut = cliCfg
      ? await callCli(cliCfg, { system: superSystem, user: egoDraft })
      : await callModel(apiKey, {
          modelId: superModelRef.model,
          system: superSystem,
          user: egoDraft,
          temperature: superTemp,
          maxTokens: superMaxTokens,
        });

    superegoCritique = superOut.content;
    deliberation.push({
      role: 'superego',
      label: 'Superego — critique',
      content: superegoCritique,
      model: cliCfg ? cliModelLabel(cliCfg) : superModelRef.model,
      provider: cliCfg ? `${cliCfg.provider}-cli` : superModelRef.provider,
      temperature: superTemp,
      latencyMs: superOut.latencyMs,
      inputTokens: superOut.inputTokens,
      outputTokens: superOut.outputTokens,
      costUsd: superOut.costUsd || 0,
    });

    const improvedMatch = superegoCritique.match(/IMPROVED:\s*([\s\S]*?)$/i);
    if (improvedMatch && improvedMatch[1]) {
      const improved = improvedMatch[1].trim();
      const approved = /^APPROVED\b/i.test(improved) || improved.length <= 20;
      if (!approved) {
        finalMessage = improved;
        wasRevised = true;
      }
    }

    deliberation.push({
      role: 'ego_revision',
      label: wasRevised ? 'Ego revision — adopts superego edits' : 'Ego revision — keeps draft (superego approved)',
      content: finalMessage,
      derivedFrom: wasRevised ? 'superego IMPROVED section' : 'original ego draft',
    });
  }

  // Some tutor prompts (notably the base tutor-ego.md) instruct the ego to emit
  // a JSON array of suggestion objects. Extract the natural-language message so
  // the chat UI can render prose. Same helper the eval engine uses for symmetry.
  const renderableFinal = extractTutorMessage(finalMessage) || finalMessage;

  return {
    finalMessage: renderableFinal,
    wasRevised,
    deliberation,
    architecture: {
      hasSuperego: !!profile.superego,
      promptType: profile.factors?.prompt_type || null,
      recognitionMode: !!profile.recognition_mode,
    },
    totals: {
      inputTokens: deliberation.reduce((s, d) => s + (d.inputTokens || 0), 0),
      outputTokens: deliberation.reduce((s, d) => s + (d.outputTokens || 0), 0),
      latencyMs: deliberation.reduce((s, d) => s + (d.latencyMs || 0), 0),
      costUsd: deliberation.reduce((s, d) => s + (d.costUsd || 0), 0),
    },
  };
}
