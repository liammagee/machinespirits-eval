/**
 * Shared Transcript Projection
 *
 * Canonical trace projection used by both CLI and web transcript tooling.
 * It provides:
 *  - sequence-diagram steps (for visual UIs)
 *  - message-chain exchanges (semantic + raw API content)
 *  - formatted transcript text (delegates to transcriptFormatter)
 *  - diagnostics (known side effects + remediation guidance)
 */

import { formatTranscript } from './transcriptFormatter.js';
import { buildDialogueFullTranscript, buildDialoguePublicTranscript } from './rubricEvaluator.js';

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tryParseJsonString(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractPrimaryMessage(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value);
    if (!parsed) return value;
    return extractPrimaryMessage(parsed);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return extractPrimaryMessage(value[0]);
  }
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.title === 'string') return value.title;
    if (Array.isArray(value.suggestions) && value.suggestions.length > 0) {
      const s = value.suggestions[0];
      if (typeof s?.message === 'string') return s.message;
      if (typeof s?.title === 'string') return s.title;
      return safeJson(s);
    }
    if (Array.isArray(value.output) && value.output.length > 0) {
      return extractPrimaryMessage(value.output[0]);
    }
  }
  return safeJson(value);
}

function extractContentField(content) {
  if (content == null) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        if (typeof item?.content === 'string') return item.content;
        return null;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : null;
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return safeJson(content);
}

function extractSystemPromptFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.system === 'string') return body.system;
  if (typeof body.systemInstruction === 'string') return body.systemInstruction;
  if (typeof body.systemInstruction?.text === 'string') return body.systemInstruction.text;
  if (Array.isArray(body.messages)) {
    const sys = body.messages
      .filter((m) => m?.role === 'system')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (sys.length > 0) return sys.join('\n\n');
  }
  return null;
}

function extractUserRequestFromRequestBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body.messages)) {
    const users = body.messages
      .filter((m) => m?.role === 'user')
      .map((m) => extractContentField(m?.content))
      .filter(Boolean);
    if (users.length > 0) return users.join('\n\n');
  }
  if (Array.isArray(body.contents)) {
    const users = body.contents
      .map((c) => {
        if (Array.isArray(c?.parts)) {
          return c.parts.map((p) => p?.text).filter(Boolean).join('\n');
        }
        return extractContentField(c?.content || c?.text || null);
      })
      .filter(Boolean);
    if (users.length > 0) return users.join('\n\n');
  }
  return null;
}

function extractResponseTextFromResponseBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  if (typeof body !== 'object') return safeJson(body);

  if (Array.isArray(body.choices) && body.choices.length > 0) {
    const first = body.choices[0];
    const content = first?.message?.content ?? first?.delta?.content ?? first?.text ?? null;
    const text = extractContentField(content);
    if (text) return text;
  }

  if (Array.isArray(body.content) && body.content.length > 0) {
    const text = extractContentField(body.content);
    if (text) return text;
  }

  if (typeof body.output_text === 'string') return body.output_text;
  if (body.candidates?.[0]?.content?.parts) {
    const parts = body.candidates[0].content.parts.map((p) => p?.text).filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }

  if (typeof body.text === 'string') return body.text;
  return safeJson(body);
}

function isModelCallEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.apiPayload || entry.api_payload) return true;
  const key = `${entry.agent || ''}:${entry.action || ''}`;
  const candidates = new Set([
    'ego:generate',
    'ego:revise',
    'ego:generate_final',
    'ego:incorporate-feedback',
    'superego:review',
    'learner_ego_initial:deliberation',
    'learner_superego:deliberation',
    'learner_ego_revision:deliberation',
    'learner:final_output',
  ]);
  return candidates.has(key);
}

function classifyChannel(entry) {
  const agent = entry?.agent || '';
  if (agent.startsWith('learner_')) return 'learner_ego_superego';
  if (agent === 'ego' || agent === 'superego') return 'tutor_ego_superego';
  if (agent === 'user') return 'tutor_learner';
  return 'unknown';
}

function extractLearnerQuery(entry) {
  const raw = entry?.rawContext || '';
  const learnerMsgRe = /Learner Messages?:\s*(.+?)(?:\n<\/|$)/s;
  const recentChatRe = /Recent Chat History\n-\s*User:\s*"(.+?)"/s;
  const match = raw.match(learnerMsgRe) || raw.match(recentChatRe);
  return match ? match[1].trim() : null;
}

function extractLearnerFollowupFromContext(rawContext) {
  const raw = rawContext || '';
  if (!raw) return null;

  function normalizeSpaces(text) {
    return String(text || '')
      .replaceAll('\n', ' ')
      .replaceAll('\t', ' ')
      .replace(/ +/g, ' ')
      .trim();
  }

  const saidMarker = '**Learner said**:';
  const saidIndex = raw.indexOf(saidMarker);
  if (saidIndex >= 0) {
    const tail = raw.slice(saidIndex + saidMarker.length).trim();
    if (tail.startsWith('"')) {
      const closing = tail.indexOf('"', 1);
      if (closing > 1) return tail.slice(1, closing).trim();
    }

    let end = tail.length;
    const idxHeading = tail.indexOf('\n###');
    const idxClose = tail.indexOf('\n</');
    if (idxHeading >= 0 && idxHeading < end) end = idxHeading;
    if (idxClose >= 0 && idxClose < end) end = idxClose;
    return normalizeSpaces(tail.slice(0, end));
  }

  const actionMarker = '### Learner Action';
  const actionIndex = raw.indexOf(actionMarker);
  if (actionIndex >= 0) {
    const block = raw.slice(actionIndex);
    let end = block.length;
    const idxHeading = block.indexOf('\n###', actionMarker.length);
    const idxClose = block.indexOf('\n</');
    if (idxHeading >= 0 && idxHeading < end) end = idxHeading;
    if (idxClose >= 0 && idxClose < end) end = idxClose;
    return normalizeSpaces(block.slice(0, end));
  }

  return null;
}

function fullContent(entry) {
  if (entry.agent === 'superego' && entry.action === 'review') {
    return entry.feedback || entry.verdict?.feedback || '';
  }
  if (entry.suggestions?.length > 0) {
    return entry.suggestions.map((s) => s.message || s.text || s.title || '').join('\n\n');
  }
  if (entry.agent === 'user' && entry.action === 'context_input') {
    return extractLearnerQuery(entry) || '(scenario context)';
  }
  if (entry.agent === 'user' && entry.action === 'turn_action') {
    return entry.contextSummary || entry.detail || '';
  }
  return entry.detail || entry.contextSummary || '';
}

function snippet(entry, maxLen = 90) {
  return fullContent(entry).substring(0, maxLen);
}

export function buildMessageChain(trace) {
  const exchanges = [];
  if (!Array.isArray(trace)) return { exchanges };

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i];
    if (!isModelCallEntry(entry)) continue;

    const payload = entry?.apiPayload || entry?.api_payload || null;
    const requestBody = payload?.request?.body ?? null;
    const responseBody = payload?.response?.body ?? null;

    const semanticSystem = null;
    const semanticUser = entry.rawContext || entry.contextSummary || entry.detail || null;
    const semanticAssistant = fullContent(entry) || null;

    const rawSystem = extractSystemPromptFromRequestBody(requestBody);
    const rawUser = extractUserRequestFromRequestBody(requestBody);
    const rawAssistant = extractResponseTextFromResponseBody(responseBody);

    exchanges.push({
      sequence: exchanges.length + 1,
      traceIndex: i,
      agent: entry.agent || 'unknown',
      action: entry.action || 'unknown',
      channel: classifyChannel(entry),
      model: entry.metrics?.model || entry.model || null,
      provider: entry.provider || entry.metrics?.provider || null,
      latencyMs: entry.metrics?.latencyMs ?? entry.latencyMs ?? null,
      hasApiPayload: !!payload,
      semantic: {
        systemPrompt: extractPrimaryMessage(semanticSystem),
        userRequest: extractPrimaryMessage(semanticUser),
        assistantResponse: extractPrimaryMessage(semanticAssistant),
      },
      raw: {
        systemPrompt: extractPrimaryMessage(rawSystem),
        userRequest: extractPrimaryMessage(rawUser),
        assistantResponse: extractPrimaryMessage(rawAssistant),
      },
    });
  }

  return { exchanges };
}

export function traceToSteps(trace) {
  const steps = [];
  if (!Array.isArray(trace) || trace.length === 0) return steps;

  let dialogueTurn = 0;
  const hasTurnActions = trace.some((e) => e.agent === 'user' && e.action === 'turn_action');

  const learnerBlockStarts = new Set();
  trace.forEach((e, i) => {
    if (e.agent === 'learner_ego_initial') learnerBlockStarts.add(i);
  });

  let needsResponseArrow = false;

  for (let i = 0; i < trace.length; i++) {
    const e = trace[i];
    const { agent, action } = e;

    if (learnerBlockStarts.has(i) && needsResponseArrow) {
      let responseContent = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = trace[j];
        if (prev.agent === 'ego' && (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')) {
          responseContent = fullContent(prev);
          break;
        }
      }
      steps.push({
        from: 'tutor_ego',
        to: 'learner_ego',
        label: 'Response',
        detail: '',
        fullDetail: responseContent,
        type: 'response',
        speaker: 'TUTOR EGO',
      });
      needsResponseArrow = false;
    }

    if (agent === 'system') continue;
    if (agent === 'user' && action === 'final_output') continue;
    if (agent === 'learner') continue;

    if (agent === 'user' && action === 'context_input') {
      dialogueTurn++;
      if (dialogueTurn === 1) {
        const query = extractLearnerQuery(e);
        const full = query || '(scenario prompt)';
        steps.push({
          from: 'learner_ego',
          to: 'tutor_ego',
          label: 'Initial query',
          detail: full.substring(0, 120),
          fullDetail: full,
          type: 'front',
          speaker: 'LEARNER',
        });
      } else if (!hasTurnActions) {
        const followup = extractLearnerFollowupFromContext(e.rawContext) || extractLearnerQuery(e) || '(learner follow-up)';
        steps.push({
          from: 'learner_ego',
          to: 'tutor_ego',
          label: `Turn ${dialogueTurn}`,
          detail: followup.substring(0, 120),
          fullDetail: followup,
          type: 'front',
          speaker: 'LEARNER',
        });
      }
      needsResponseArrow = true;
      continue;
    }

    if (agent === 'ego' && (action === 'generate' || action === 'revise' || action === 'incorporate-feedback')) {
      const full = fullContent(e);
      let superegoFollows = false;
      for (let j = i + 1; j < trace.length; j++) {
        if (trace[j].agent === 'superego' && trace[j].action === 'review') {
          superegoFollows = true;
          break;
        }
        if (learnerBlockStarts.has(j)) break;
        if (trace[j].agent === 'user' && trace[j].action === 'context_input') break;
      }

      if (action !== 'generate' && !superegoFollows) {
        steps.push({
          from: 'tutor_ego',
          to: 'learner_ego',
          label: 'Response',
          detail: '',
          fullDetail: full,
          type: 'response',
          latency: e.metrics?.latencyMs || null,
          speaker: 'TUTOR EGO',
          model: e.metrics?.model || null,
        });
        needsResponseArrow = false;
      } else {
        const label = action === 'generate' ? 'Draft' : 'Revised';
        steps.push({
          from: 'tutor_ego',
          to: 'tutor_superego',
          label,
          detail: snippet(e, 120),
          fullDetail: full,
          type: 'back',
          latency: e.metrics?.latencyMs || null,
          speaker: action === 'generate' ? 'TUTOR EGO (draft)' : 'TUTOR EGO (revised)',
          model: e.metrics?.model || null,
        });
      }
      continue;
    }

    if (agent === 'superego' && action === 'review') {
      const approved = e.approved;
      const full = fullContent(e);
      if (approved) {
        steps.push({
          from: 'tutor_superego',
          to: 'tutor_ego',
          label: 'Approved ✓',
          detail: snippet(e, 120),
          fullDetail: full,
          type: 'back',
          approved: true,
          latency: e.metrics?.latencyMs || null,
          speaker: 'SUPEREGO',
          model: e.metrics?.model || null,
        });
        let responseContent = '';
        for (let j = i - 1; j >= 0; j--) {
          const prev = trace[j];
          if (prev.agent === 'ego' && (prev.action === 'generate' || prev.action === 'revise' || prev.action === 'incorporate-feedback')) {
            responseContent = fullContent(prev);
            break;
          }
        }
        steps.push({
          from: 'tutor_ego',
          to: 'learner_ego',
          label: 'Response',
          detail: '',
          fullDetail: responseContent,
          type: 'response',
          speaker: 'TUTOR EGO',
        });
        needsResponseArrow = false;
      } else {
        steps.push({
          from: 'tutor_superego',
          to: 'tutor_ego',
          label: 'Revise ↻',
          detail: snippet(e, 120),
          fullDetail: full,
          type: 'back',
          approved: false,
          latency: e.metrics?.latencyMs || null,
          speaker: 'SUPEREGO',
          model: e.metrics?.model || null,
        });
      }
      continue;
    }

    if (agent === 'learner_ego_initial' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_ego',
        to: 'learner_superego',
        label: 'Reaction',
        detail: snippet(e, 120),
        fullDetail: full,
        type: 'back',
        speaker: 'LEARNER EGO',
      });
      continue;
    }

    if (agent === 'learner_superego' && action === 'deliberation') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_superego',
        to: 'learner_ego',
        label: 'Critique',
        detail: snippet(e, 120),
        fullDetail: full,
        type: 'back',
        speaker: 'LEARNER SUPEREGO',
      });
      continue;
    }

    if (agent === 'learner_ego_revision') continue;

    if (agent === 'user' && action === 'turn_action') {
      const full = fullContent(e);
      steps.push({
        from: 'learner_ego',
        to: 'tutor_ego',
        label: `Turn ${dialogueTurn + 1}`,
        detail: snippet(e, 120),
        fullDetail: full,
        type: 'front',
        speaker: 'LEARNER',
      });
      needsResponseArrow = true;
      continue;
    }
  }

  return steps;
}

export function buildProjectionDiagnostics({ trace = [], steps = [], messageChain = { exchanges: [] } } = {}) {
  const exchanges = messageChain.exchanges || [];
  const modelCallCount = exchanges.length;
  const missingPayloadCount = exchanges.filter((e) => !e.hasApiPayload).length;
  const missingTurnIndexCount = trace.filter((e) => e?.turnIndex === undefined).length;
  const contextInputs = trace.filter((e) => e.agent === 'user' && e.action === 'context_input').length;
  const turnActions = trace.filter((e) => e.agent === 'user' && e.action === 'turn_action').length;
  const heuristicFollowups = Math.max(0, contextInputs - 1 - turnActions);

  const effects = [];

  if (missingPayloadCount > 0 && modelCallCount > 0) {
    effects.push({
      id: 'missing_api_payload_capture',
      severity: 'medium',
      message: `${missingPayloadCount}/${modelCallCount} model exchanges lack raw request/response payload capture; message-chain view falls back to semantic reconstruction.`,
      remedialSteps: [
        'Keep EVAL_CAPTURE_API_PAYLOADS enabled for new runs.',
        'Treat reconstructed raw fields as approximate for historical logs.',
        'Use semantic lane for judge-facing interpretation when raw payload is absent.',
      ],
    });
  }

  if (heuristicFollowups > 0) {
    effects.push({
      id: 'heuristic_followup_reconstruction',
      severity: 'medium',
      message: `${heuristicFollowups} learner follow-up turn(s) were inferred from repeated context_input blocks (no explicit turn_action present).`,
      remedialSteps: [
        'Emit explicit user/turn_action entries for all follow-up turns.',
        'Include stable turnIndex on every tutor and learner trace entry.',
        'Re-run affected scenarios when strict turn boundaries are required.',
      ],
    });
  }

  if (missingTurnIndexCount > 0) {
    effects.push({
      id: 'missing_turn_index',
      severity: 'low',
      message: `${missingTurnIndexCount} trace entries have no turnIndex; downstream grouping depends on inferred ordering.`,
      remedialSteps: [
        'Attach turnIndex at trace emission time for all agents.',
        'Add CI checks that reject traces with missing turnIndex for multi-turn scenarios.',
      ],
    });
  }

  if (steps.length === 0 && trace.length > 0) {
    effects.push({
      id: 'no_visible_steps',
      severity: 'high',
      message: 'Trace contained entries, but no user-visible steps could be projected.',
      remedialSteps: [
        'Verify trace schema compatibility (agent/action fields).',
        'Add fallback mapping rules for new entry types before running analysis.',
      ],
    });
  }

  return {
    effectCount: effects.length,
    hasBlocking: effects.some((e) => e.severity === 'high'),
    effects,
    summary:
      effects.length === 0
        ? 'No projection side effects detected.'
        : `${effects.length} projection side effect(s) detected.`,
  };
}

export function projectTranscriptArtifacts(params = {}) {
  const {
    trace = [],
    turnResults = [],
    learnerContext = '',
    scenarioName = '',
    profileName = '',
    totalTurns = 0,
    detail = 'play',
  } = params;

  const safeTrace = Array.isArray(trace) ? trace : [];
  const steps = traceToSteps(safeTrace);
  const messageChain = buildMessageChain(safeTrace);
  const formatted = formatTranscript(safeTrace, {
    detail,
    scenarioName,
    profileName,
    totalTurns,
  });
  const judged = {
    publicTranscript: buildDialoguePublicTranscript(turnResults, safeTrace, learnerContext),
    fullTranscript: buildDialogueFullTranscript(turnResults, safeTrace, learnerContext),
  };
  const diagnostics = buildProjectionDiagnostics({
    trace: safeTrace,
    steps,
    messageChain,
  });

  return {
    trace: safeTrace,
    steps,
    messageChain,
    formatted,
    judged,
    diagnostics,
  };
}

export default {
  buildMessageChain,
  traceToSteps,
  buildProjectionDiagnostics,
  projectTranscriptArtifacts,
};

