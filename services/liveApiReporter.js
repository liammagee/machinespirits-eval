/**
 * Live API Reporter
 *
 * Streams a compact one-line display for each LLM API call as it completes.
 * Uses AsyncLocalStorage to propagate conversation identity (profile + scenario)
 * so each call can be annotated with its origin without threading callbacks.
 *
 * Usage:
 *   const reporter = new LiveApiReporter();
 *   reporter.install();
 *   await reporter.withConversation({ profileName, scenarioId }, async () => { ... });
 *   reporter.uninstall();
 */

import { AsyncLocalStorage } from 'async_hooks';
import { setGlobalOnRecord } from './apiPayloadCapture.js';
import theme from './cliTheme.js';

const { chalk } = theme;

// 8 distinct hex colors for conversation lane identification
const LANE_PALETTE = [
  '#5B9BD5', // blue
  '#E67E22', // orange
  '#2ECC71', // green
  '#E74C3C', // red
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#F39C12', // amber
  '#3498DB', // sky
];

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
  }
  return content == null ? '' : String(content);
}

/** Infer agent role from system prompt keywords. Extended for learner roles. */
function inferRole(body) {
  const systemText = typeof body?.system === 'string'
    ? body.system
    : Array.isArray(body?.messages)
      ? (body.messages.find((m) => m.role === 'system')?.content || '')
      : '';
  const sys = extractText(systemText).toLowerCase();

  // Learner roles (check before tutor since learner prompts may contain 'tutor' references)
  if (sys.includes('learner') && sys.includes('superego')) return 'learner_sup';
  if (sys.includes('learner') && (sys.includes('ego') || sys.includes('revision'))) return 'learner_ego';
  if (sys.includes('learner')) return 'learner';

  // Self-reflection / profiling / disposition
  if (sys.includes('self-reflect') || sys.includes('self_reflect')) return 'reflect';
  if (sys.includes('profil')) return 'profile';
  if (sys.includes('disposition') || sys.includes('rewriting pad') || sys.includes('writing pad')) return 'rewrite';

  // Tutor roles
  if (sys.includes('superego') || sys.includes('critic') || sys.includes('review the following')) return 'superego';
  if (sys.includes('tutor') || sys.includes('pedagog')) return 'ego';

  return 'unknown';
}

/** Color a role label with the appropriate agent color. */
function colorRole(role) {
  const label = role.padEnd(12);
  switch (role) {
    case 'ego': return theme.tutorEgo(label);
    case 'superego': return theme.tutorSuperego(label);
    case 'learner_ego': return theme.learnerEgo(label);
    case 'learner_sup': return theme.learnerSuperego(label);
    case 'learner': return theme.learnerEgo(label);
    case 'reflect': return chalk.blueBright(label);
    case 'profile': return chalk.blueBright(label);
    case 'rewrite': return chalk.yellowBright(label);
    default: return chalk.white(label);
  }
}

/** Extract a short model alias from a full model string. */
function shortModel(model) {
  if (!model || typeof model !== 'string') return '?';
  // Strip common prefixes (openrouter paths like "nvidia/llama-3.1-nemotron-70b...")
  const parts = model.split('/');
  let name = parts[parts.length - 1];
  // Truncate overly long model names
  if (name.length > 24) name = name.slice(0, 22) + '..';
  return name;
}

/** Extract token counts from response body. */
function extractTokens(responseBody) {
  const usage = responseBody?.usage;
  if (!usage) return null;
  return {
    input: usage.prompt_tokens ?? usage.input_tokens ?? null,
    output: usage.completion_tokens ?? usage.output_tokens ?? null,
  };
}

export class LiveApiReporter {
  constructor() {
    this.conversationContext = new AsyncLocalStorage();
    this.colorMap = new Map();
    this.colorIndex = 0;
    this.callCount = 0;
  }

  /** Register the global callback on the fetch wrapper. */
  install() {
    setGlobalOnRecord((record) => this._onRecord(record));
  }

  /** Unregister the global callback. */
  uninstall() {
    setGlobalOnRecord(null);
  }

  /**
   * Run an async function with conversation identity metadata.
   * Any LLM call made within `fn` will be annotated with this metadata.
   */
  withConversation(meta, fn) {
    return this.conversationContext.run(meta, fn);
  }

  /**
   * Update the current conversation's turn index (for multi-turn progress).
   * Must be called from within a withConversation() scope.
   */
  setTurnIdx(turnIdx) {
    const store = this.conversationContext.getStore();
    if (store) store.turnIdx = turnIdx;
  }

  /** Get the lane color for a conversation key. */
  _laneColor(key) {
    if (!this.colorMap.has(key)) {
      this.colorMap.set(key, chalk.hex(LANE_PALETTE[this.colorIndex % LANE_PALETTE.length]));
      this.colorIndex++;
    }
    return this.colorMap.get(key);
  }

  /** Handle a completed API call record. */
  _onRecord(record) {
    this.callCount++;
    const num = String(this.callCount).padStart(3);

    // Read conversation context (may be null if call is outside withConversation)
    const meta = this.conversationContext.getStore();
    const profileName = meta?.profileName || '?';
    const scenarioId = meta?.scenarioId || '?';
    const turnIdx = meta?.turnIdx;

    // Short identifiers
    const shortProfile = profileName.replace(/^cell_\d+_/, '').replace(/_/g, '-').slice(0, 16);
    const shortScenario = scenarioId.replace(/_/g, '-').slice(0, 16);
    const conversationKey = `${profileName}|${scenarioId}`;
    const laneColor = this._laneColor(conversationKey);

    // Infer role from request body
    const body = record.request?.body;
    const role = inferRole(body);
    const modelName = shortModel(body?.model);

    // Duration
    const sec = record.durationMs != null ? (record.durationMs / 1000).toFixed(1).padStart(5) + 's' : '   ? s';

    // Tokens
    const responseBody = record.response?.json || record.response?.body;
    const tokens = extractTokens(responseBody);
    const tokenStr = tokens
      ? chalk.dim(`${(tokens.input ?? '?').toLocaleString()}->${(tokens.output ?? '?').toLocaleString()}`)
      : '';

    // Turn indicator for multi-turn
    const turnStr = turnIdx != null ? chalk.dim(` T${turnIdx}`) : '';

    // Error indicator
    const errStr = record.error ? chalk.red(' ERR') : '';

    // Assemble line
    const line = [
      chalk.dim(`  #${num}`),
      laneColor(`${shortProfile}|${shortScenario}`.padEnd(34)),
      turnStr,
      colorRole(role),
      theme.model(modelName.padEnd(24)),
      sec,
      tokenStr,
      errStr,
    ].filter(Boolean).join(' ');

    process.stderr.write(line + '\n');
  }
}
