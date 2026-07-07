// Agon LLM adapter — thin wrapper over services/cliProviderBridge.js.
//
// Providers per AGON-GAME-PLAN.md: tutor ego + superego on the codex CLI
// (gpt-5.5), learner on the claude CLI (Sonnet 5). Both run on subscription
// quota via the shared bridge (which handles the env hygiene: metered-API key
// removal for claude, read-only tmpdir confinement for codex).
//
// The bridge does no retries; this adapter adds bounded retry on transport
// errors/empty output. Envelope *format* repair (model answered but not in
// contract) is the runner's job — it re-prompts with REPAIR_NOTE.

import { callAIWithCliBridge } from '../cliProviderBridge.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function makeCliAgents({
  tutorProvider = 'codex',
  tutorModel = 'gpt-5.5',
  learnerProvider = 'claude-code',
  learnerModel = 'claude-sonnet-5',
  tutorTimeoutMs = Number(process.env.AGON_TUTOR_TIMEOUT_MS || 300_000),
  learnerTimeoutMs = Number(process.env.AGON_LEARNER_TIMEOUT_MS || 240_000),
  maxAttempts = 2,
  log = () => {},
} = {}) {
  async function call(role, agentConfig, systemPrompt, userPrompt, timeoutMs) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await callAIWithCliBridge(agentConfig, systemPrompt, userPrompt, role, {
          timeoutMs,
        });
        if (result?.text && result.text.trim().length > 0) return result;
        lastError = new Error(`${role}: empty response from ${agentConfig.provider}`);
      } catch (err) {
        lastError = err;
      }
      log(`[agon] ${role} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      if (attempt < maxAttempts) await sleep(attempt === 1 ? 1000 : 3000);
    }
    throw lastError;
  }

  const tutorConfig = { provider: tutorProvider, model: tutorModel };
  const learnerConfig = { provider: learnerProvider, model: learnerModel };

  return {
    descriptor: {
      tutor: `${tutorProvider}/${tutorModel}`,
      learner: `${learnerProvider}/${learnerModel}`,
    },
    tutorEgo: ({ system, user }) => call('agon-tutor-ego', tutorConfig, system, user, tutorTimeoutMs),
    tutorSuperego: ({ system, user }) => call('agon-tutor-superego', tutorConfig, system, user, tutorTimeoutMs),
    learner: ({ system, user }) => call('agon-learner', learnerConfig, system, user, learnerTimeoutMs),
  };
}

// ---------------------------------------------------------------------------
// Envelope parsing
// ---------------------------------------------------------------------------

// Accepts either the contract form (```json fence, ---, visible message) or a
// bare JSON object followed by the message. Returns {envelope, visible,
// parseMode} or null when no JSON object can be recovered.
export function parseAgentOutput(text) {
  if (!text || typeof text !== 'string') return null;

  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    const envelope = tryParseJson(fenceMatch[1]);
    if (envelope) {
      const after = text.slice(text.indexOf(fenceMatch[0]) + fenceMatch[0].length);
      return { envelope, visible: stripSeparator(after), parseMode: 'fence' };
    }
  }

  const braceStart = text.indexOf('{');
  if (braceStart >= 0) {
    const scan = scanBalancedObject(text, braceStart);
    if (scan) {
      const envelope = tryParseJson(scan.json);
      if (envelope) {
        return { envelope, visible: stripSeparator(text.slice(scan.end)), parseMode: 'bare' };
      }
    }
  }
  return null;
}

function tryParseJson(s) {
  try {
    const parsed = JSON.parse(s.trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stripSeparator(s) {
  return s.replace(/^\s*-{3,}\s*/, '').trim();
}

// Depth-scan for the first balanced {...}, respecting JSON strings.
function scanBalancedObject(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { json: text.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}
