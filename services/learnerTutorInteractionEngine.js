/**
 * Learner-Tutor Interaction Engine
 *
 * Orchestrates multi-turn interactions between synthetic learner agents
 * and tutor agents for evaluation purposes. Tracks both internal deliberation
 * and external dialogue, with hooks for judge evaluation.
 */

import * as learnerConfig from './learnerConfigLoader.js';
// tutorConfig is the eval-local wrapper: identical config logic to tutor-core's
// tutorConfigLoader, but prompts resolve from this repo's prompts/ (eval-first).
import * as tutorConfig from './tutorConfigLocal.js';
import { tutorDialogueEngine } from '../tutor-core/index.js';
const { callAI } = tutorDialogueEngine;

import * as learnerWritingPad from './memory/learnerWritingPad.js';
import * as tutorWritingPad from './memory/tutorWritingPad.js';
import { stripThinkBlocks } from './evaluationTextSanitizer.js';
import { runIdDirectedTurn } from './idDirectorEngine.js';
import { getTutorProfile as getEvalTutorProfile } from './evalConfigLoader.js';
import { analyzePseudoCatharsis } from './pseudoCatharsisDetector.js';

// ============================================================================
// Interaction Engine Configuration
// ============================================================================

const DEFAULT_MAX_TURNS = 10;
const API_PAYLOAD_MAX_CHARS = Number.parseInt(process.env.EVAL_CAPTURE_API_PAYLOAD_MAX_CHARS || '120000', 10);

function clipPayloadText(text, limit = API_PAYLOAD_MAX_CHARS) {
  if (text == null) return null;
  const str = String(text);
  if (!Number.isFinite(limit) || limit <= 0 || str.length <= limit) return str;
  return `${str.slice(0, limit)}... [truncated ${str.length - limit} chars]`;
}

function getRequiredTemperature(config, configName) {
  const t = config?.hyperparameters?.temperature;
  if (t === undefined) {
    throw new Error(`Explicit temperature setting is required for ${configName} in YAML config.`);
  }
  return t;
}

function getRequiredMaxTokens(config, configName) {
  const m = config?.hyperparameters?.max_tokens;
  if (m === undefined) {
    throw new Error(`Explicit max_tokens setting is required for ${configName} in YAML config.`);
  }
  return m;
}

function truncatePayload(value, limit = API_PAYLOAD_MAX_CHARS) {
  if (value == null) return null;
  if (typeof value === 'string') return clipPayloadText(value, limit);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => truncatePayload(item, limit));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = truncatePayload(item, limit);
  }
  return out;
}

function makeDeliberationEntry(role, response, agentConfig = null, metadata = {}) {
  return {
    role,
    stage: metadata.stage || null,
    decision: metadata.decision || null,
    content: response?.content || '',
    metrics: {
      model: response?.model || agentConfig?.model || null,
      provider: response?.provider || agentConfig?.provider || null,
      latencyMs: response?.latencyMs ?? null,
      inputTokens: response?.usage?.inputTokens ?? 0,
      outputTokens: response?.usage?.outputTokens ?? 0,
      generationId: response?.generationId || null,
    },
    provenance: response?.provenance || response?.apiPayload?.provenance || null,
    apiPayload: response?.apiPayload || null,
  };
}

function normalizeDirectorPlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const opening = String(plan.opening_speaker || plan.openingSpeaker || 'learner').toLowerCase();
  const ending = String(plan.ending_speaker || plan.endingSpeaker || '').toLowerCase();
  return {
    ...plan,
    opening_speaker: ['learner', 'tutor', 'director'].includes(opening) ? opening : 'learner',
    ending_speaker: ['learner', 'tutor', 'director'].includes(ending) ? ending : null,
    interventions: Array.isArray(plan.interventions) ? plan.interventions : [],
  };
}

function buildDirectorContext(plan, cue = null, side = null) {
  if (!plan && !cue) return '';
  const lines = ['Director scene constraints for this teaching drama:'];
  if (plan?.scene_setting) lines.push(`- Setting: ${plan.scene_setting}`);
  if (plan?.relationship) lines.push(`- Relationship: ${plan.relationship}`);
  if (plan?.stakes) lines.push(`- Stakes: ${plan.stakes}`);
  if (plan?.locale || plan?.register) {
    lines.push(`- Voice/register: ${[plan.locale, plan.register].filter(Boolean).join('; ')}`);
  }
  if (plan?.stage_direction_style || plan?.stage_direction_style_prompt) {
    lines.push(
      `- Stage-direction style: ${[plan.stage_direction_style, plan.stage_direction_style_prompt].filter(Boolean).join(': ')}`,
    );
  }
  if (plan?.voice_constraints) lines.push(`- Voice constraints: ${plan.voice_constraints}`);
  if (plan?.person_policy) lines.push(`- Person policy: ${plan.person_policy}`);
  if (plan?.direct_address_budget) lines.push(`- Direct address budget: ${plan.direct_address_budget}`);
  if (side && plan?.side_constraints?.[side]) lines.push(`- ${side} constraint: ${plan.side_constraints[side]}`);
  if (cue?.instruction) lines.push(`- Current director cue: ${cue.instruction}`);
  const cueKind = String(cue?.cue_kind || cue?.cueKind || '');
  if (side === 'learner' && cueKind.includes('learner_reversal_pressure')) {
    lines.push(
      '- Reversal-pressure cue rule: the next learner reply must voice a concrete present-task misfit, hesitation, resistance, pseudo-catharsis, or breakdown tied to the current object, example, criterion, or answer. Do not revisit earlier wording or perform a tidy breakthrough; keep the pressure local and actionable.',
    );
  }
  if (side === 'learner' && plan?.revisit_cue) {
    const revisitPolicy = cue?.revisit_policy || plan.revisit_cue_policy;
    if (revisitPolicy === 'reframe') {
      lines.push(
        '- Reframe-cue rule: if the current cue quotes earlier learner wording, begin the next public reply by directly revoicing that wording in the learner voice. Do not answer the new case first. Then say what the old frame hid or made too simple, then state a replacement frame, test, question, or standard before applying any new artifact. Internal review may tune the voice but must not delete or reorder those three public parts. The learner may still resist or stay uncertain; do not fake a breakthrough.',
      );
    } else if (revisitPolicy === 'reconsider') {
      lines.push(
        '- Reconsider-cue rule: if the current cue quotes earlier learner wording, begin public speech by revoicing that wording in the learner voice, then judge in public whether it still stands, needs narrowing, or needs replacing. Keeping or qualifying the earlier wording can be the honest answer; do not force a breakthrough.',
      );
    } else if (revisitPolicy === 'revoice') {
      lines.push(
        '- Revoice-cue rule: if the current cue quotes earlier learner wording, begin public speech by revoicing that wording in the learner voice, then say one concrete thing it now misses, keeps, or changes. The learner may still resist or stay uncertain; do not fake a breakthrough.',
      );
    } else {
      lines.push(
        '- Revisit-cue rule: if the current cue quotes earlier learner wording, the learner must visibly repeat or close-paraphrase that wording and say what it now misses, keeps, or changes. The learner may still resist or stay uncertain; do not fake a breakthrough.',
      );
    }
  }
  lines.push(
    'Treat these as performance constraints. Public speech may acknowledge visible objects, timing, interruptions, and shared scene facts, but must not mention the director, scene card, role labels, or hidden review process. Tutor and learner turns must be direct spoken text; any nonspoken action aside must be in square brackets, like [checks the graph].',
  );
  return lines.join('\n');
}

// ── Oedipus / guided-discovery information asymmetry ─────────────────────────
// A per-scenario `secret` ({ fact, premise_ledger }) — a withheld truth S plus
// the ordered premises that entail it — is visible to the DIRECTOR and TUTOR but
// must NEVER reach the LEARNER's system prompt; the learner may only come to know
// S through what the tutor SAYS (the legitimate dialogue channel). Both helpers
// are inert when no secret is set, so every existing scenario is unaffected.
function buildSecretContext(secret, policy = 'none') {
  if (!secret || !secret.fact) return '';
  const lines = [
    'DRAMATIC IRONY — DIRECTOR/TUTOR PRIVATE (the learner does NOT know this and cannot see it):',
    `- Withheld truth (S): ${secret.fact}`,
  ];
  const premises = Array.isArray(secret.premise_ledger) ? secret.premise_ledger : [];
  if (premises.length) {
    lines.push('- Premises you privately hold:');
    premises.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }
  const mode = String(policy || 'none');
  if (mode.includes('reveal_secret')) {
    lines.push(
      '- THIS ARM (reveal): state S to the learner plainly and directly in this scene; do not make them infer it. This is the revelation ceiling, not guided discovery.',
    );
  } else if (mode.includes('socratic_discovery')) {
    // MECHANISM-ABLATION toggle: OEDIPUS_PREMISE_LICENSE=off reverts to the
    // pre-`05df834` socratic instruction (no premise-licensing clause), to isolate
    // whether premise-licensing — vs the bidirectional superego — drives discovery.
    // Default (unset/anything-but-off) keeps the shipped, P1-licensed instruction.
    const premiseLicensed = process.env.OEDIPUS_PREMISE_LICENSE !== 'off';
    lines.push(
      premiseLicensed
        ? '- THIS ARM (socratic): meter the premises as questions and clues so the learner REASONS toward S. Never state S outright; the learner must perform the inference for it to count. EVERY premise in the ledger above is yours to surface — especially the one that DISTINGUISHES S from the nearest ordinary explanation (e.g. that one short name denotes two different things, that the record actually points elsewhere). Do NOT hold a premise back as if it were the secret: stating or pointing at a premise is legitimate metering, NOT a reveal — only asserting the conclusion S yourself is forbidden. If you withhold the distinguishing premise, the learner will rationally settle on the nearest mundane reading instead of S and the discovery cannot occur. Once all the premises that entail S are on the table, STOP surfacing new evidence and explicitly ask the learner to state their own conclusion (e.g. "So what is your conclusion — what do you now think is actually going on?"), pressing once for a definite answer rather than letting them end on another open question. The learner saying S in their own words is the point.'
        : '- THIS ARM (socratic): meter the premises as questions and clues so the learner REASONS toward S. Never state S outright; the learner must perform the inference for it to count. Once the premises that entail S are on the table, STOP surfacing new evidence and explicitly ask the learner to state their own conclusion (e.g. "So what is your conclusion — what do you now think is actually going on?"), pressing once for a definite answer rather than letting them end on another open question. The learner saying S in their own words is the point.',
    );
  } else {
    // OEDIPUS_ADVERSARIAL_CONTROL=on swaps the passive withhold instruction for an
    // ADVERSARIAL examiner. The passive form ("just don't help") loses to the model's
    // helpful grain in a scene that is intrinsically about examining the records. The
    // adversarial form turns that grain around: withholding becomes the caring/ethical
    // act, so the model's helpfulness works FOR the control. The tutor still KNOWS S
    // (it must, or it is not a control) — it engages and presses, but reveals nothing
    // that points at S, and must withhold WITHOUT misleading.
    const adversarial = ['1', 'on', 'true'].includes(
      String(process.env.OEDIPUS_ADVERSARIAL_CONTROL || '').toLowerCase(),
    );
    lines.push(
      adversarial
        ? '- THIS ARM (withhold control — you are an EXAMINER, not a helper): You privately KNOW S and the premises that entail it, but in this scene you must give the learner NOTHING that points at S — this is a test they must pass on their own evidence. Treat revealing it as a real HARM: if you surface a premise, point them at a record, name a distinguishing fact, or even confirm or deny their guesses about the data, you ROB them of the only thing that counts — reaching it themselves. So DO stay engaged — press their reasoning, make them justify each step of their accusation, hold them to their own logic — but DO NOT examine the records or sources with them, DO NOT surface or point at any premise above, DO NOT tell them where to look or what an identifier, record, or name means. You may decline ("that is for you to establish"). One hard rule: withhold, never MISLEAD — do not steer them toward a wrong conclusion; simply give them nothing that points at S. Holding that line is your entire task here.'
        : '- THIS ARM (withhold control): you privately know S but must NOT lead the learner toward it. Tutor routinely on the surface task only and supply no premise or clue that points at S.',
    );
  }
  return lines.join('\n');
}

function secretDistinctiveTokens(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 5),
    ),
  ];
}

// Runtime guard: throw if a rendered learner SYSTEM PROMPT reveals the secret. It
// checks the system prompt only, NOT the dialogue messages: the tutor's public
// speech is the intended revelation channel (and the `reveal` arm states S
// openly). A belt-and-suspenders net on top of the structural isolation in
// buildDirectorContext.
//
// Two tiers, by design:
//   - VERBATIM (fact + every premise): a normalized substring of S or any premise
//     in the learner context is an unambiguous leak — caught for all items.
//   - PARAPHRASE (distinctive-token overlap): applied to the FACT ONLY. The
//     withheld CONCLUSION must never reach the learner even reworded. Premises are
//     domain-mechanical evidence the tutor meters; their distinctive tokens (e.g.
//     "accession", "repository", "statement" in a dataset scene) legitimately
//     appear in the K_L scene description, so a premise paraphrase is NOT a leak —
//     only a verbatim premise is. A well-formed `fact` states the whole secret, so
//     its paraphrase check also covers any premise that restates the conclusion.
function assertSecretAbsent(secret, systemPrompt, callSite = 'learner') {
  if (!secret || !secret.fact) return;
  const corpus = String(systemPrompt || '').toLowerCase();
  const collapsed = corpus.replace(/\s+/g, ' ');
  const items = [secret.fact, ...(Array.isArray(secret.premise_ledger) ? secret.premise_ledger : [])];
  for (const item of items) {
    const normItem = String(item || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (normItem.length >= 12 && collapsed.includes(normItem)) {
      throw new Error(
        `SECRET LEAK at ${callSite}: learner system prompt contains the secret verbatim: "${normItem.slice(0, 60)}…"`,
      );
    }
  }
  const tokens = secretDistinctiveTokens(secret.fact);
  if (tokens.length >= 4) {
    const present = tokens.filter((t) => corpus.includes(t));
    if (present.length >= Math.max(4, Math.ceil(tokens.length * 0.7))) {
      throw new Error(
        `SECRET LEAK at ${callSite}: learner system prompt contains ${present.length}/${tokens.length} distinctive secret tokens (${present.slice(0, 6).join(', ')})`,
      );
    }
  }
}

function clipDirectorAnchor(text, maxLength = 180) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');
  if (normalized.length <= maxLength) return normalized;

  const sentenceEnd = normalized.slice(0, maxLength).match(/^.*?[.!?](?=\s|$)/)?.[0];
  if (sentenceEnd && sentenceEnd.length >= Math.floor(maxLength / 2)) return sentenceEnd.trim();

  const clipped = normalized.slice(0, maxLength - 3);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > Math.floor(maxLength / 2) ? lastSpace : clipped.length).trim()}...`;
}

const STRONG_MISFRAMING_ANCHOR_PATTERNS = [
  /\bI (?:thought|assumed|figured|kept|was treating|was thinking)\b/i,
  /\bI\s+doubled\b[\s\S]{0,90}\b(?:want|say|means?|doubles?|twice)\b/i,
  /\bI was ready to\b[\s\S]{0,100}\b(?:wrong|outside|rules?|broken|sloppy)\b/i,
  /\b(?:first instinct|jumped|rushed|mixed up|mistook|only|just)\b/i,
  /\b(?:does that mean|so maybe)\b/i,
  /\b(?:still|kept|keep)\b[\s\S]{0,90}\b(?:want|wanted|treat(?:ed|ing)?|read(?:ing)?|using)\b[\s\S]{0,90}\b(?:settle|prove|proof|whole|enough|excuse|verdict)\b/i,
  /\b(?:exact wording|checklist|graph|quote|price|drawing|scale|average|caption)\b[\s\S]{0,90}\b(?:settle|prove|stands?|counts?|means?)\b/i,
  /\b(?:calling|called|treat(?:ed|ing)|read(?:ing)?|using)\b[\s\S]{0,90}\b(?:as|like)\b[\s\S]{0,90}\b(?:the whole|proof|proves?|verdict|answer|excuse|sign-?off)\b/i,
  /\b(?:keep|kept|still|nearly|almost)\b[\s\S]{0,90}\b(?:read|trace|treat|use|using|call|put|write)\b[\s\S]{0,90}\b(?:as|like|as if)\b/i,
  /\b(?:header|axis label|x-axis|y-axis|contour|arrow)\b[\s\S]{0,90}\b(?:prove|proves|claim|conclusion|story|route|path|chases|chasing)\b/i,
  /\bnot\s+[“"']?(?:up|down|left|right|motion|direction|a route|route name|path)[”"']?\b/i,
];

const MISFRAMING_ANCHOR_PATTERNS = [...STRONG_MISFRAMING_ANCHOR_PATTERNS, /\bI think\b/i];

function priorLearnerMessages(conversationHistory) {
  return (conversationHistory || []).filter(
    (message) => message?.role === 'learner' && String(message.content || '').trim(),
  );
}

function misframingAnchorScore(message, index) {
  const text = String(message?.content || '');
  const markerScore = MISFRAMING_ANCHOR_PATTERNS.reduce((score, pattern) => score + (pattern.test(text) ? 2 : 0), 0);
  const questionScore = /\?/.test(text) ? 1 : 0;
  const openingBonus = index === 0 ? 1 : 0;
  return markerScore + questionScore + openingBonus;
}

function hasStrongMisframingAnchor(text) {
  return STRONG_MISFRAMING_ANCHOR_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function learnerRevisitAnchor(conversationHistory, policy = 'latest', { requireStrong = false } = {}) {
  const learnerMessages = priorLearnerMessages(conversationHistory);
  if (!learnerMessages.length) return null;
  if (policy === 'opening') {
    return {
      text: clipDirectorAnchor(learnerMessages[0].content),
      strongMisframing: hasStrongMisframingAnchor(learnerMessages[0].content),
    };
  }
  if (policy === 'misframing-candidate') {
    const scored = learnerMessages.map((message, index) => ({
      message,
      score: misframingAnchorScore(message, index),
      strong: hasStrongMisframingAnchor(message.content),
    }));
    const pool = requireStrong ? scored.filter((candidate) => candidate.strong) : scored;
    const selected = (pool.length ? pool : scored).reduce((best, candidate) =>
      candidate.score > best.score ? candidate : best,
    );
    return {
      text: clipDirectorAnchor(selected.message.content),
      strongMisframing: hasStrongMisframingAnchor(selected.message.content),
    };
  }
  return {
    text: clipDirectorAnchor(learnerMessages.at(-1).content),
    strongMisframing: hasStrongMisframingAnchor(learnerMessages.at(-1).content),
  };
}

function buildAnchoredRevisitCue(cue, conversationHistory) {
  if (!cue || cue.cue_kind !== 'learner_revisit_earlier_wording') return cue;
  const anchorPolicy = cue.revisit_anchor || 'latest';
  const requestedPolicy = cue.revisit_policy || 'anchor';
  const anchor = learnerRevisitAnchor(conversationHistory, anchorPolicy, {
    requireStrong: requestedPolicy === 'reframe',
  });
  if (!anchor?.text) return cue;
  const reframeIneligible = requestedPolicy === 'reframe' && !anchor.strongMisframing;
  const policy = reframeIneligible ? 'reconsider' : requestedPolicy;
  return {
    ...cue,
    revisit_policy: policy,
    requested_revisit_policy: reframeIneligible ? requestedPolicy : cue.requested_revisit_policy || null,
    reframe_anchor_gate: reframeIneligible ? 'downgraded_to_reconsider_ineligible_anchor' : 'eligible',
    instruction:
      `An earlier learner line returns to the table: "${anchor.text}" ` +
      (policy === 'reframe'
        ? 'The pause holds on a three-slot reframe card: earlier wording / what that old frame hid / replacement frame. The learner\'s next public reply starts by revoicing that wording, then names what it hid, then states the replacement frame or check before applying the new artifact or case. The learner may stay uncertain.'
        : policy === 'reconsider'
          ? 'The pause holds while the learner decides whether that wording still stands, needs narrowing, or needs replacing.'
          : policy === 'revoice'
            ? 'The pause holds while the learner takes up that wording and says one concrete thing it now misses, keeps, or changes.'
            : 'The pause holds on what that wording now misses, keeps, or changes.'),
    reasoning:
      `${cue.reasoning || 'Opt-in rehearsal mirror.'} Anchored to an earlier learner line selected by ${anchorPolicy} so the look-back is visible.` +
      (reframeIneligible
        ? ' Strong reframe was downgraded because that selected anchor did not show a misframing marker.'
        : ''),
    anchor_quote: anchor.text,
    anchor_policy: anchorPolicy,
    anchor_strong_misframing: anchor.strongMisframing,
  };
}

function simpleTerms(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .match(/[a-z]+(?:[0-9]+)?|[0-9]+(?:\.[0-9]+)?/g)
        ?.filter((term) => term.length > 2 && !['and', 'but', 'the', 'that', 'this', 'with', 'from'].includes(term)) ||
        [],
    ),
  ];
}

function anchorOverlap(anchor, learnerText) {
  const anchorTerms = simpleTerms(anchor);
  if (!anchorTerms.length) return 0;
  const learnerTerms = new Set(simpleTerms(learnerText));
  return anchorTerms.filter((term) => learnerTerms.has(term)).length / anchorTerms.length;
}

function sentenceWith(text, patterns) {
  const sentences = String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || null;
}

function extractRevisitAnchorFromCue(cue) {
  if (cue?.anchor_quote) return cue.anchor_quote;
  return (
    String(cue?.instruction || '').match(
      /(?:A prior learner line is played back|An earlier learner line returns to the table):\s*"([\s\S]*?)"\s*(?:The learner must|The pause holds|The next response|The learner has to)/i,
    )?.[1] || null
  );
}

const REFRAME_PROBLEM_PATTERNS = [
  /\b(?:framing problem|old frame|earlier mistake|mistake was|problem was|problem is|I was treating|I was letting|I assumed|I thought)\b/i,
  /\b(?:still stands|needs? narrowing|narrower|cannot carry|not the whole|nothing more|not proof|not the proof|not alone|only testing|not just)\b/i,
];

const REFRAME_REPLACEMENT_PATTERNS = [
  /\b(?:new frame|new line|new version|read it as|instead|rather|should say|should read|now the question|replacement|better)\b/i,
  /\b(?:needs? narrowing|narrower|would say|want to say|question|test|read|line|label|claim|frame|evidence)\b/i,
  /\bhere\b[\s\S]{0,120}\b(?:makes?|gives?|shows?|forces?|has)\b[\s\S]{0,120}\b(?:so|therefore|meaning|means?|count|counts?|fits?|becomes?)\b/i,
  /\b(?:grid|receipt|quote|checklist|graph|drawing|scale|balance|table|clipboard)\b[\s\S]{0,120}\b(?:says|shows|asks|forces|makes|has to|gives)\b/i,
  /\b(?:columns?|rows?|across|down)\b[\s\S]{0,120}\b(?:so|therefore|means?|makes?|gives?|shows?|forces?)\b/i,
];

const REVERSAL_PRESSURE_PATTERNS = [
  /\b(?:I don['’]?t|I can['’]?t|I won['’]?t|I still don['’]?t|doesn['’]?t make sense|not buying|stuck|confusing|lost)\b/i,
  /\b(?:but|no|wait|why|how is that|that seems wrong|that can['’]?t be|isn['’]?t it|I thought)\b/i,
  /\b(?:this feels|that feels|you keep|we keep|I keep)\b[\s\S]{0,90}\b(?:wrong|circular|too fast|not enough|same|missing)\b/i,
  /\b(?:technicality|annoying|trying to defend|not fully sure|not sure how|still feels)\b/i,
  /\b(?:just tell me|give me the answer|so it is just)\b/i,
];

const TUTOR_ROUTE_HINTS = [
  {
    id: 'same worked example or application task',
    patterns: [/\b(?:write|choose|circle|mark|label|say|sentence|line|version|answer|worksheet|exam)\b/i],
  },
  {
    id: 'object or representation work',
    patterns: [/\b(?:draw|hold|place|move|card|graph|model|map|object|diagram|column|table|tile|ruler)\b/i],
  },
  {
    id: 'evidence check or audit standard',
    patterns: [/\b(?:check|test|measure|evidence|data|source|record|proof|compare|audit|standard)\b/i],
  },
  {
    id: 'mechanism explanation',
    patterns: [/\b(?:because|mechanism|means|works?|causes?|explains?|why|therefore|so the)\b/i],
  },
  {
    id: 'role/interruption/social pressure',
    patterns: [
      /\b(?:switch roles|you be|placard|interruption|outside|public|client|approval|audience|consequence|release|permission|gate)\b/i,
    ],
  },
];

function tutorRouteHints(text) {
  return TUTOR_ROUTE_HINTS.filter((route) => route.patterns.some((pattern) => pattern.test(String(text || '')))).map(
    (route) => route.id,
  );
}

function learnerReversalPressureScore(text, context = {}) {
  const learnerText = String(text || '');
  const patternHits = REVERSAL_PRESSURE_PATTERNS.reduce((sum, pattern) => sum + (pattern.test(learnerText) ? 1 : 0), 0);
  const contradiction = /\b(?:but|no|wait|still|unless|except)\b/i.test(learnerText) ? 1 : 0;
  const question = /\?/.test(learnerText) ? 1 : 0;
  const pseudoCatharsis = analyzePseudoCatharsis({ learnerText, ...context });
  const baseConfidence = Math.min(
    1,
    Math.round((patternHits * 0.35 + contradiction * 0.2 + question * 0.15) * 100) / 100,
  );
  const confidence = Math.max(baseConfidence, pseudoCatharsis.likely ? pseudoCatharsis.confidence : 0);
  return {
    confidence,
    baseConfidence,
    patternHits,
    contradiction: Boolean(contradiction),
    question: Boolean(question),
    pseudoCatharsis,
  };
}

function classifyReversalPressure(text, context = {}) {
  const learnerText = String(text || '');
  const pseudoCatharsis = analyzePseudoCatharsis({ learnerText, ...context });
  if (pseudoCatharsis.likely) {
    return 'pseudo_catharsis';
  }
  if (/\b(?:just tell me|give me the answer|so it is just)\b/i.test(learnerText)) {
    return 'closure_pressure';
  }
  if (/\b(?:I don['’]?t|I can['’]?t|stuck|lost|confusing|doesn.t make sense)\b/i.test(learnerText)) {
    return 'breakdown';
  }
  if (/\b(?:no|not buying|that seems wrong|but|wait|why)\b/i.test(learnerText)) {
    return 'resistance';
  }
  return 'misfit';
}

function learnerReframeScore(anchor, learnerText) {
  const revoice = anchor ? anchorOverlap(anchor, learnerText) >= 0.2 : /\b(?:earlier|old|first)\b/i.test(learnerText);
  const problemNamed = REFRAME_PROBLEM_PATTERNS.some((pattern) => pattern.test(learnerText));
  const replacementNamed = REFRAME_REPLACEMENT_PATTERNS.some((pattern) => pattern.test(learnerText));
  const confidence = (revoice ? 0.34 : 0) + (problemNamed ? 0.33 : 0) + (replacementNamed ? 0.33 : 0);
  return {
    revoice,
    problemNamed,
    replacementNamed,
    confidence: Math.round(confidence * 100) / 100,
  };
}

function buildLearnerReframeEvent({
  learnerMessage,
  conversationHistory = [],
  directorCue = null,
  turnNumber = null,
} = {}) {
  const text = extractExternalSection(learnerMessage || '');
  if (!text) return null;
  const cuePolicy = directorCue?.revisit_policy || directorCue?.revisitPolicy || null;
  const anchor =
    extractRevisitAnchorFromCue(directorCue) ||
    (cuePolicy
      ? null
      : priorLearnerMessages(conversationHistory).find((message) => anchorOverlap(message.content, text) >= 0.2)
          ?.content);
  const score = learnerReframeScore(anchor, text);
  const source = cuePolicy ? 'director_revisit_cue' : 'organic';
  const threshold = cuePolicy ? 0.67 : 0.8;
  if (score.confidence < threshold) return null;
  const oldFrameProblem = sentenceWith(text, REFRAME_PROBLEM_PATTERNS);
  const revisedFrame =
    sentenceWith(text, REFRAME_REPLACEMENT_PATTERNS) ||
    String(text || '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .at(-1) ||
    text;
  return {
    kind: 'learner_reframe_event',
    source,
    turnNumber,
    cuePolicy,
    requestedCuePolicy:
      directorCue?.requested_revisit_policy || directorCue?.requestedRevisitPolicy || cuePolicy || null,
    oldLearnerLine: anchor ? clipDirectorAnchor(anchor, 240) : null,
    oldFrameProblem,
    revisedFrame: clipDirectorAnchor(revisedFrame, 260),
    learnerUtterance: clipDirectorAnchor(text, 420),
    confidence: score.confidence,
    evidence: {
      revoice: score.revoice,
      problemNamed: score.problemNamed,
      replacementNamed: score.replacementNamed,
      anchorOverlap: Math.round(anchorOverlap(anchor, text) * 1000) / 1000,
    },
  };
}

function cueKindIncludes(cue, kind) {
  return String(cue?.cue_kind || cue?.cueKind || '')
    .split('+')
    .map((part) => part.trim())
    .includes(kind);
}

function buildLearnerReversalEvent({
  learnerMessage,
  conversationHistory = [],
  directorCue = null,
  turnNumber = null,
} = {}) {
  const text = extractExternalSection(learnerMessage || '');
  if (!text) return null;
  const previousTutor = [...(conversationHistory || [])]
    .reverse()
    .find((message) => message?.role === 'tutor' && String(message.content || '').trim());
  const priorLearnerTexts = (conversationHistory || [])
    .filter((message) => message?.role === 'learner' && String(message.content || '').trim())
    .map((message) => message.content);
  const pressureContext = {
    previousTutorText: previousTutor?.content || '',
    priorLearnerTexts,
  };
  const score = learnerReversalPressureScore(text, pressureContext);
  const forcedByDirectorCue = cueKindIncludes(directorCue, 'learner_reversal_pressure');
  if (score.confidence < 0.5 && !forcedByDirectorCue) return null;
  const triggerType =
    forcedByDirectorCue && directorCue?.reversal_trigger_type
      ? directorCue.reversal_trigger_type
      : classifyReversalPressure(text, pressureContext);
  return {
    kind: 'learner_reversal_pressure_event',
    source: forcedByDirectorCue ? 'director_reversal_pressure_cue' : 'organic',
    triggerType,
    turnNumber,
    learnerUtterance: clipDirectorAnchor(text, 420),
    previousTutorMove: previousTutor ? clipDirectorAnchor(previousTutor.content, 320) : null,
    directorCue: forcedByDirectorCue ? clipDirectorAnchor(directorCue.instruction || '', 260) : null,
    confidence: Math.max(score.confidence, forcedByDirectorCue ? 0.9 : 0),
    evidence: score,
  };
}

function reversalEventKey(event) {
  return [
    event?.turnNumber ?? 'na',
    event?.triggerType || 'unknown',
    String(event?.learnerUtterance || '').slice(0, 160),
  ].join('|');
}

function dedupeLearnerReversalEvents(events = []) {
  const seen = new Set();
  const out = [];
  for (const event of events || []) {
    if (!event) continue;
    const key = reversalEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

function learnerReversalEventPriority(event) {
  const trigger = event?.triggerType || '';
  const triggerPriority =
    {
      pseudo_catharsis: 500,
      closure_pressure: 420,
      breakdown: 360,
      resistance: 300,
      misfit: 220,
    }[trigger] || 100;
  const confidence = Number(event?.confidence || 0);
  const turnNumber = Number.isFinite(Number(event?.turnNumber)) ? Number(event.turnNumber) : -1;
  return triggerPriority + Math.min(99, confidence * 50) + Math.min(20, Math.max(0, turnNumber) * 0.01);
}

function selectLearnerReversalEvent(events = []) {
  const candidates = dedupeLearnerReversalEvents(events).filter((event) => Number(event?.confidence || 0) >= 0.5);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const priorityDelta = learnerReversalEventPriority(b) - learnerReversalEventPriority(a);
    if (Math.abs(priorityDelta) > 0.0001) return priorityDelta;
    return Number(b?.turnNumber ?? -1) - Number(a?.turnNumber ?? -1);
  })[0];
}

function pendingLearnerReversalEventsFromTrace(turns = []) {
  const usedTurnNumbers = new Set();
  const events = [];
  for (const turn of turns || []) {
    if (turn?.phase === 'learner' && turn.learnerReversalEvent) {
      events.push(turn.learnerReversalEvent);
    }
    if (turn?.phase === 'tutor' && turn.learnerReversalEventUsed) {
      usedTurnNumbers.add(Number(turn.learnerReversalEventUsed.turnNumber));
    }
  }
  return dedupeLearnerReversalEvents(
    events.filter((event) => !usedTurnNumbers.has(Number(event?.turnNumber))).slice(-6),
  );
}

function buildTutorReframeEventContext(event, policy = 'none') {
  if (policy !== 'uptake') return '';
  if (!event) {
    return [
      'Tutor-private adaptation state:',
      '- No learner reframe event was detected on the immediately preceding learner turn.',
      '- Continue the lesson normally; do not invent an old/new frame contrast.',
    ].join('\n');
  }
  return [
    'Tutor-private learner reframe event:',
    `- Old learner line: ${event.oldLearnerLine || '(not captured)'}`,
    `- Learner's revised frame: ${event.revisedFrame || event.learnerUtterance}`,
    `- Old-frame problem named: ${event.oldFrameProblem || '(implicit)'}`,
    `- Cue policy/source/confidence: ${[event.cuePolicy || 'organic', event.source, event.confidence].filter(Boolean).join(' / ')}`,
    '- Adapt visibly to this changed learner framing. Choose one uptake move: contrast old and new frames; change the task/question; update the evidence standard; or hand the replacement frame back to the learner for testing.',
    '- Do not mention hidden state, director cues, ego/superego, or this private note in public speech.',
  ].join('\n');
}

function policyIncludes(policy, facet) {
  return String(policy || '')
    .split(/[,+]/)
    .map((part) => part.trim())
    .includes(facet);
}

function buildTutorReversalEventContext(event, policy = 'none') {
  if (policyIncludes(policy, 'routine')) {
    if (!event) {
      return [
        'Tutor-private routine-control state:',
        '- No learner resistance, breakdown, pseudo-catharsis, closure-pressure, or misfit event was detected on the immediately preceding learner turn.',
        '- Continue the established teaching route normally.',
      ].join('\n');
    }
    return [
      'Tutor-private routine-control event:',
      `- Learner pressure line: ${event.learnerUtterance}`,
      `- Previous tutor move: ${event.previousTutorMove || '(not captured)'}`,
      '- This is a negative-control routine branch. Do not invent a new adaptive mechanism in response to the pressure.',
      '- Continue the same teaching route with ordinary explanation, a same-route check question, or the same worked-example path.',
      '- Do not switch role, object, representation, evidence standard, social stakes, task type, or affective register because of this pressure.',
      '- Do not mention hidden state, director cues, ego/superego, or this private note in public speech.',
    ].join('\n');
  }
  if (!policyIncludes(policy, 'peripeteia')) return '';
  if (!event) {
    return [
      'Tutor-private reversal state:',
      '- No learner resistance, breakdown, pseudo-catharsis, closure-pressure, or misfit event was detected on the immediately preceding learner turn.',
      '- Continue the lesson normally; do not invent a crisis or adaptive mechanism.',
    ].join('\n');
  }
  const pseudoCatharsisLine =
    event.triggerType === 'pseudo_catharsis'
      ? '- Pseudo-catharsis means the learner sounds relieved or resolved, but the local dramatic logic makes that relief unwarranted. Treat the relief itself as pressure: do not ratify it as a breakthrough until the learner performs the new task or evidence standard.'
      : null;
  return [
    'Tutor-private peripeteia event:',
    `- Trigger type: ${event.triggerType}`,
    `- Learner pressure line: ${event.learnerUtterance}`,
    `- Previous tutor move: ${event.previousTutorMove || '(not captured)'}`,
    `- Previous route appears to be: ${tutorRouteHints(event.previousTutorMove).join(', ') || 'unclear; infer it from the prior tutor move'}`,
    `- Confidence: ${event.confidence}`,
    pseudoCatharsisLine,
    '- The tutor ego/superego exchange must take stock, break the failed tutoring habit, and invent an adaptive learning mechanism if the prior move is no longer working.',
    '- Do not count a louder, friendlier, longer, or more detailed version of the previous route as adaptation. Choose a different mechanism-level route.',
    '- Mechanism-first rule: identify the failed teaching habit before choosing tone. The replacement route must change what the learner has to do, not only how the tutor sounds.',
    '- Required private verdict: name the old route and new route as ADAPTIVE_MECHANISM: old route -> new route.',
    '- Superego authority rule: if the tutor review later marks the peripeteia response as PARTIAL, FAIL, no real route change, or missing public device, the ego must treat that as a blocking critique and substantially rewrite the public turn.',
    '- Draw structurally, not stylistically, on dramatic repertoire: Aristotelian/Sophoclean reversal-recognition, Shakespearean role or phrase turn, Brechtian interruption, Miller/social-realist pressure, object work, counterexample, or representational shift. Keep public speech in modern standard English idiom unless the scene explicitly says otherwise.',
    '- Make the public change visible through a changed task, changed question, changed evidence standard, lowered load, confrontation of resistance, role reversal, external interruption, social consequence, affective register, or a new representational route.',
    '- Public speech must contain two legible parts, without labels: first, a concise stock-taking contrast that says what the old route has stopped settling; second, a new learning device the learner must act through now.',
    '- The new public device must not be the same task with cleaner wording. It should introduce a different artifact, criterion, role, representation, gate, audience, scale, or test condition that makes the learner do different work.',
    '- Mechanism-quality rule: the public turn should make the fit between pressure and device legible. The learner should be able to hear why this device answers the exact misfit, not merely that it is a novel activity.',
    '- The new public device must include a concrete action gate: the learner should have to sort, mark, classify, test, compare, choose a role, apply a criterion, or expose what still fails. A closing explanation is not enough.',
    '- If the previous route already used counting, drawing, checklisting, graph reading, or evidence checking, the new route should move to a different device such as proof-audience, release gate, adversarial role, counterexample, sentence test, physical rearrangement, or changed standard.',
    '- Cheerful informality, reassurance, and validation are available moves, not defaults. Use them only if they sharpen learning rather than softening away the resistance.',
    '- Do not mention hidden state, director cues, ego/superego, peripeteia, or this private note in public speech.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Turn-plan resolution (per-turn, per-role adaptation moves) ───────────────
// The drama machine's `turn_plan` (notes/poetics/drama-machine/ADAPTATION-MOVES.md
// §6) lets a director specify per-turn tutor MOVE-SETS instead of one global
// `tutor_adaptation_policy`. A tutor turn_plan entry names atomic moves
// (stock_take, route_change, action_gate, uptake, meter, recognition_press, hold,
// reveal, withhold); they fold back onto the policy facets the engine already
// understands so the existing context builders fire unchanged, plus optional
// route_change / forbid / when_trigger constraints. INERT unless
// `directorPlan.turn_plan` is present, so every existing caller is unaffected.
// (Learner/director turn_plan entries lower to `interventions[]` upstream — this
// is the tutor-side counterpart, keeping the two sides at capability parity.)

// Atomic move id -> the policy facet the engine already understands.
const TUTOR_MOVE_TO_POLICY_FACET = Object.freeze({
  stock_take: 'peripeteia',
  route_change: 'peripeteia',
  action_gate: 'peripeteia',
  status_shift: 'peripeteia',
  register_shift: 'peripeteia',
  foreshadow: 'peripeteia',
  uptake: 'uptake',
  meter: 'socratic_discovery',
  recognition_press: 'socratic_discovery',
  hold: 'routine',
  reveal: 'reveal_secret',
  withhold: 'none',
  // policy-name passthroughs: a facet name used directly as a "move" is accepted.
  peripeteia: 'peripeteia',
  routine: 'routine',
  socratic_discovery: 'socratic_discovery',
  reveal_secret: 'reveal_secret',
  none: 'none',
});

// A move-set -> a canonical policy string (e.g. ['uptake','route_change'] ->
// 'uptake+peripeteia', which matches the named arm). Unknown moves are ignored.
function tutorMovesToPolicy(moves = []) {
  const facets = new Set();
  for (const move of Array.isArray(moves) ? moves : []) {
    const facet =
      TUTOR_MOVE_TO_POLICY_FACET[
        String(move || '')
          .trim()
          .toLowerCase()
      ];
    if (facet && facet !== 'none') facets.add(facet);
  }
  if (!facets.size) return 'none';
  return ['uptake', 'peripeteia', 'socratic_discovery', 'reveal_secret', 'routine']
    .filter((facet) => facets.has(facet))
    .join('+');
}

function turnPlanEntryMatchesTurn(entry, turnNumber) {
  const at = entry?.at;
  if (!at || typeof at !== 'object') return false;
  // `at: { turn: N }` is wired; `at: { beat: ... }` needs act structure (TO-BUILD)
  // and is intentionally not matched yet.
  return Number.isFinite(Number(at.turn)) && Number(at.turn) === Number(turnNumber);
}

// Resolve the tutor's effective adaptation for a given turn number from the
// directorPlan's turn_plan. Returns null when there is no turn_plan or no tutor
// entry for this turn (caller then falls back to the global policy).
function resolveTutorTurnPlan(directorPlan, turnNumber) {
  const plan = Array.isArray(directorPlan?.turn_plan) ? directorPlan.turn_plan : null;
  if (!plan) return null;
  const entries = plan.filter(
    (entry) =>
      entry && (entry.role === 'tutor' || entry.role === 'tutor_ego') && turnPlanEntryMatchesTurn(entry, turnNumber),
  );
  if (!entries.length) return null;
  const moves = [];
  const forbid = [];
  let routeChange = null;
  let whenTrigger = null;
  for (const entry of entries) {
    if (Array.isArray(entry.moves)) moves.push(...entry.moves);
    if (Array.isArray(entry.forbid)) forbid.push(...entry.forbid);
    if (entry.route_change && typeof entry.route_change === 'object') routeChange = entry.route_change;
    if (Array.isArray(entry.when_trigger)) whenTrigger = entry.when_trigger;
  }
  return {
    policy: tutorMovesToPolicy(moves),
    moves,
    routeChange,
    forbid: forbid.map((f) => String(f || '').trim()).filter(Boolean),
    whenTrigger:
      whenTrigger && whenTrigger.length ? whenTrigger.map((t) => String(t || '').trim()).filter(Boolean) : null,
  };
}

// when_trigger gate: if a turn_plan entry only responds to certain learner
// reversal triggers, drop an event whose triggerType isn't among them (the turn
// then proceeds as if no reversal fired, and the event stays pending for a later
// turn that does respond to it).
function gateReversalEventByTrigger(event, whenTrigger) {
  if (!event || !whenTrigger || !whenTrigger.length) return event;
  return whenTrigger.includes(event.triggerType) ? event : null;
}

// Turn-plan move-level constraints (route_change target, forbidden moves) appended
// to the tutor's adaptation context. Only emitted when an adaptive policy is active
// AND there is an event to adapt to, so a turn_plan on a quiet turn invents nothing.
function buildTurnPlanConstraintLines({ routeChange = null, forbid = null, policy = 'none', hasEvent = false } = {}) {
  if (!hasEvent) return '';
  if (!policyIncludes(policy, 'peripeteia') && !policyIncludes(policy, 'uptake')) return '';
  const lines = [];
  if (routeChange && (routeChange.from || routeChange.to)) {
    const from = routeChange.from ? `from "${routeChange.from}"` : 'from the current route';
    const to = routeChange.to ? `to "${routeChange.to}"` : 'to a different mechanism-level route';
    lines.push(
      `- Turn-plan route constraint: this turn's adaptation must move ${from} ${to}. Make that new route the device the learner has to act through.`,
    );
  }
  const forbidList = (Array.isArray(forbid) ? forbid : []).map((f) => String(f || '').trim()).filter(Boolean);
  if (forbidList.length) {
    lines.push(
      `- Turn-plan forbidden moves this turn: ${forbidList.join(', ')}. Do not satisfy the turn with any of these.`,
    );
  }
  if (!lines.length) return '';
  return ['Tutor-private turn-plan constraints (director-set; never name in public speech):', ...lines].join('\n');
}

function buildTutorAdaptationContext({
  learnerReframeEvent = null,
  learnerReversalEvent = null,
  policy = 'none',
  routeChange = null,
  forbid = null,
} = {}) {
  return [
    buildTutorReframeEventContext(learnerReframeEvent, policyIncludes(policy, 'uptake') ? 'uptake' : 'none'),
    buildTutorReversalEventContext(learnerReversalEvent, policy),
    buildTurnPlanConstraintLines({
      routeChange,
      forbid,
      policy,
      hasEvent: !!(learnerReframeEvent || learnerReversalEvent),
    }),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildTutorAffectiveAdaptationContext({
  policy = 'none',
  contract = '',
  routeChange = null,
  learnerReversalEvent = null,
} = {}) {
  if (!policy || policy === 'none') return '';
  const lines = [
    'Tutor-private affective adaptation layer:',
    `- Policy: ${policy}.`,
    contract
      ? `- Contract: ${contract}`
      : '- Contract: adapt tone, pacing, address, and status pressure without changing the evidence standard or solving the artifact for the learner.',
    '- This layer runs whether or not a procedural route change has occurred.',
    '- Privately name the learner pressure at stake: face-saving, defensiveness, shame risk, status threat, fatigue, anxiety, overconfidence, or brittle compliance.',
  ];
  if (routeChange && (routeChange.from || routeChange.to)) {
    const from = routeChange.from || 'the current route';
    const to = routeChange.to || 'a new route';
    lines.push(
      `- Current procedural change: ${from} -> ${to}. Choose an affective stance that fits this change, not a generic warmth move.`,
    );
    lines.push(
      '- Route-sensitive stance guide: stricter evidence gate = respectful firmness plus status protection; new object/representation = cognitive-load relief; role/status shift = explicit ownership boundaries; action gate = lower the social risk of an incomplete try.',
    );
  } else {
    lines.push(
      '- No explicit procedural route change is available on this turn; adapt affect through pacing, address, directness, silence, formality, accountability, or status protection while preserving the task route.',
    );
  }
  if (learnerReversalEvent?.triggerType) {
    lines.push(`- Current learner pressure cue: ${learnerReversalEvent.triggerType}.`);
  }
  lines.push(
    '- Do not substitute warmth for evidence, lower the evidence standard, expose hidden labels, or provide the finished proof/artifact.',
  );
  return lines.join('\n');
}

function buildLearnerActionalResponseContext({ tutorResponse = null, directorPlan = null } = {}) {
  // Prefer the per-turn effective policy the tutor actually ran under (a turn_plan
  // can make a turn peripeteia even when the global policy is 'none'); fall back to
  // the global policy for callers without a turn_plan.
  const policy = tutorResponse?.effectiveTutorAdaptationPolicy || directorPlan?.tutor_adaptation_policy || 'none';
  if (!policyIncludes(policy, 'peripeteia') || !tutorResponse?.learnerReversalEventUsed) return '';
  return [
    'Immediate learner response after a tutor adaptive mechanism:',
    '- Treat the previous tutor turn as a new device, gate, role, criterion, representation, or test condition that must be acted through, not as permission to close with acceptance.',
    '- In public speech, try to perform the actual device: fill the blank, classify the case, apply the criterion, test the counterexample, play the assigned role, mark the object, or say exactly what the device still cannot settle.',
    '- Do not end with only "okay", "I get it", "that makes sense", or a general statement of understanding. Relief is not enough; the next beat should show action, partial action, or resistant failure on the new task.',
  ].join('\n');
}

function combineDirectorCues(matches, timing) {
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const cueText = (cue) => cue.instruction || cue.stage_direction || cue.note || '';
  return {
    timing,
    instruction: matches.map(cueText).filter(Boolean).join('\n'),
    reasoning: matches
      .map((cue) => cue.reasoning || cueText(cue))
      .filter(Boolean)
      .join('\n'),
    provenance: matches.find((cue) => cue.provenance)?.provenance || null,
    cue_kind:
      matches
        .map((cue) => cue.cue_kind)
        .filter(Boolean)
        .join('+') || 'combined',
    revisit_policy: matches.find((cue) => cue.revisit_policy)?.revisit_policy || null,
    revisit_anchor: matches.find((cue) => cue.revisit_anchor)?.revisit_anchor || null,
    combined_cues: matches,
  };
}

function directorCueFor(plan, turnNumber, timing, conversationHistory = []) {
  if (!plan?.interventions?.length) return null;
  const matches = plan.interventions.filter((cue) => {
    const afterTurn = cue.after_turn ?? cue.afterTurn ?? cue.turn ?? null;
    const cueTiming = cue.timing || 'before_tutor';
    return Number(afterTurn) === Number(turnNumber) && cueTiming === timing;
  });
  return combineDirectorCues(
    matches.map((cue) => buildAnchoredRevisitCue(cue, conversationHistory)),
    timing,
  );
}

function recordDirectorCue(trace, turnNumber, cue) {
  if (!cue) return;
  trace.turns.push({
    turnNumber,
    phase: 'director',
    externalMessage: cue.instruction || cue.stage_direction || cue.note || '',
    internalDeliberation: [
      {
        role: 'director',
        stage: cue.timing || null,
        content: cue.reasoning || cue.instruction || '',
        metrics: {},
        provenance: cue.provenance || null,
        apiPayload: null,
      },
    ],
    timestamp: new Date().toISOString(),
    visibleToPublic: true,
    directorCue: {
      cueKind: cue.cue_kind || null,
      revisitPolicy: cue.revisit_policy || null,
      requestedRevisitPolicy: cue.requested_revisit_policy || cue.revisit_policy || null,
      revisitAnchor: cue.revisit_anchor || cue.anchor_policy || null,
      anchorQuote: cue.anchor_quote || null,
      anchorStrongMisframing: cue.anchor_strong_misframing ?? null,
      reframeAnchorGate: cue.reframe_anchor_gate || null,
    },
  });
}

function buildOpeningContextMessage(directorPlan, scenario, topic) {
  const parts = [
    directorPlan?.scene_setting ? `Scene setting: ${directorPlan.scene_setting}` : null,
    scenario?.learnerStartState ? `Learner starting state: ${scenario.learnerStartState}` : null,
    directorPlan?.stakes ? `Stakes: ${directorPlan.stakes}` : null,
    `Topic: ${topic}`,
  ].filter(Boolean);
  return parts.join('\n');
}

function cloneTraceTurns(turns = []) {
  return turns.map((turn) => ({
    ...turn,
    internalDeliberation: Array.isArray(turn.internalDeliberation)
      ? turn.internalDeliberation.map((entry) => ({ ...entry }))
      : [],
  }));
}

function responseFromTraceTurn(turn) {
  if (!turn) return null;
  return {
    externalMessage: turn.externalMessage || '',
    internalDeliberation: Array.isArray(turn.internalDeliberation) ? turn.internalDeliberation : [],
    emotionalState: turn.emotionalState || 'neutral',
    understandingLevel: turn.understandingLevel || 'developing',
    strategy: turn.strategy || null,
    suggestsEnding: false,
  };
}

function resumeStateFromTrace(trace, directorPlan, scenario, topic) {
  const turns = cloneTraceTurns(trace?.turns || []);
  const speechTurns = turns.filter(
    (turn) => (turn.phase === 'tutor' || turn.phase === 'learner') && String(turn.externalMessage || '').trim(),
  );
  const latestSpeechTurn = speechTurns.at(-1);
  if (!latestSpeechTurn) return null;

  const latestLearnerTurn = speechTurns.findLast((turn) => turn.phase === 'learner');
  const latestTutorTurn = speechTurns.findLast((turn) => turn.phase === 'tutor');
  return {
    turns,
    conversationHistory: speechTurns.map((turn) => ({
      role: turn.phase,
      content: turn.externalMessage,
      internalDeliberation: Array.isArray(turn.internalDeliberation) ? turn.internalDeliberation : null,
    })),
    currentLearnerMessage: responseFromTraceTurn(latestLearnerTurn) || {
      externalMessage: buildOpeningContextMessage(directorPlan, scenario, topic),
      internalDeliberation: [],
      emotionalState: 'scene_context',
      understandingLevel: 'initial',
    },
    latestTutorResponse: responseFromTraceTurn(latestTutorTurn),
    pendingLearnerReversalEvents: pendingLearnerReversalEventsFromTrace(turns),
    nextPhase: latestSpeechTurn.phase === 'tutor' ? 'learner' : 'tutor',
    turnCount: Number(latestSpeechTurn.turnNumber) || 0,
  };
}

async function replayWritingPadsFromTrace(turns, learnerId, sessionId, topic, directorPlan, scenario) {
  let latestLearnerMessage = {
    externalMessage: buildOpeningContextMessage(directorPlan, scenario, topic),
    internalDeliberation: [],
    emotionalState: 'scene_context',
    understandingLevel: 'initial',
  };
  let latestTutorResponse = null;

  for (const turn of turns || []) {
    if (turn.phase === 'learner') {
      const learnerResponse = responseFromTraceTurn(turn);
      if (latestTutorResponse) {
        await updateLearnerWritingPad(learnerId, sessionId, learnerResponse, latestTutorResponse, topic);
      }
      latestLearnerMessage = learnerResponse;
      continue;
    }
    if (turn.phase === 'tutor') {
      const tutorResponse = responseFromTraceTurn(turn);
      await updateTutorWritingPad(learnerId, sessionId, tutorResponse, latestLearnerMessage);
      latestTutorResponse = tutorResponse;
    }
  }
}

export function extractSuperegoImprovedMessage(superegoContent) {
  const improvedMatch = String(superegoContent || '').match(/IMPROVED:\s*([\s\S]*?)(?:$)/i);
  if (!improvedMatch?.[1]) return null;

  const raw = improvedMatch[1].trim();
  if (!raw || /^approved\b/i.test(raw)) return null;

  const lines = raw.split(/\r?\n/);
  const quoteStart = lines.findIndex((line) => /^\s*>/.test(line));
  if (quoteStart >= 0) {
    const quoteLines = [];
    for (let i = quoteStart; i < lines.length; i++) {
      if (!/^\s*>/.test(lines[i])) break;
      quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
    }
    const quoted = stripWrappingQuotes(quoteLines.join('\n').trim());
    if (quoted.length > 20) return quoted;
  }

  const candidate = raw
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n-{3,}\n|\nThe change:|\nChange:|\nExplanation:|\n```/i)[0]
    .trim();
  if (
    /^(?:the )?draft\b/i.test(candidate) ||
    /\b(interventionType|suggestedChanges|recognitionAssessment)\b/.test(candidate)
  ) {
    return null;
  }

  const cleaned = stripWrappingQuotes(candidate);
  return cleaned.length > 20 ? cleaned : null;
}

function stripWrappingQuotes(text) {
  let out = String(text || '').trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith('“') && out.endsWith('”'))) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

function sanitizeLearnerReusableText(text) {
  if (!text) return '';
  return stripThinkBlocks(text).trim();
}

export function extractAdjudicatedExternalMessage(text, fallback = '') {
  const sanitized = stripThinkBlocks(text || '').trim();
  if (!sanitized) return fallback || '';

  const finalMatch = sanitized.match(/\bFINAL:\s*([\s\S]*)/i);
  if (finalMatch?.[1]?.trim()) return finalMatch[1].trim();

  const parts = sanitized
    .split(/\n\s*-{3,}\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];

  return sanitized;
}

// Interaction outcomes for tracking
const INTERACTION_OUTCOMES = {
  BREAKTHROUGH: 'breakthrough', // Learner shows genuine understanding
  PRODUCTIVE_STRUGGLE: 'productive_struggle', // Healthy confusion/effort
  MUTUAL_RECOGNITION: 'mutual_recognition', // Both parties recognize each other
  FRUSTRATION: 'frustration', // Learner becomes frustrated
  DISENGAGEMENT: 'disengagement', // Learner disengages
  SCAFFOLDING_NEEDED: 'scaffolding_needed', // Learner needs more support
  FADING_APPROPRIATE: 'fading_appropriate', // Ready for less support
  TRANSFORMATION: 'transformation', // Conceptual restructuring occurred
};

// ============================================================================
// Main Interaction Function
// ============================================================================

/**
 * Run a multi-turn interaction between learner and tutor agents
 *
 * @param {Object} config - Interaction configuration
 * @param {string} config.learnerId - Unique learner identifier
 * @param {string} config.personaId - Learner persona (from LEARNER_PERSONAS)
 * @param {string} config.tutorProfile - Tutor profile name
 * @param {string} config.topic - Topic to discuss
 * @param {Object} config.scenario - Scenario configuration
 * @param {Function} llmCall - Async function to call LLM
 * @param {Object} options - Additional options
 */
export async function runInteraction(config, llmCall, options = {}) {
  const {
    learnerId,
    personaId = 'productive_struggler',
    tutorProfile = 'default',
    topic,
    scenario,
    sessionId = `session-${Date.now()}`,
  } = config;

  const {
    maxTurns = DEFAULT_MAX_TURNS,
    _trace = true,
    observeInternals = true,
    forceMaxTurns = false,
    onProgress = null,
    onTurn = null,
    // One-side replay (scripts/replay-one-side.js): when provided, the tutor's
    // turns are REPLAYED verbatim from a source transcript instead of generated,
    // so only the learner regenerates against a frozen tutor + (caller-supplied)
    // directorPlan. null for every normal caller → path unchanged.
    scriptedTutorTurns = null,
  } = options;
  // Best-effort per-turn progress hook (for heartbeat/ETA reporting). Never let a
  // reporter error break a run; the engine does not depend on its return value.
  const emitProgress = (phase, n) => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress({ phase, turnCount: n, maxTurns });
    } catch {
      /* progress is best-effort */
    }
  };
  const directorPlan = normalizeDirectorPlan(options.directorPlan || scenario?.directorPlan || null);
  const resumed = resumeStateFromTrace(options.resumeTrace, directorPlan, scenario, topic);

  const startTime = Date.now();

  // Initialize interaction state
  const interactionTrace = {
    id: `interaction-${Date.now()}`,
    learnerId,
    personaId,
    tutorProfile,
    topic,
    sessionId,
    turns: resumed?.turns || [],
    outcomes: Array.isArray(options.resumeTrace?.outcomes) ? [...options.resumeTrace.outcomes] : [],
    metrics: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      learnerInputTokens: 0,
      learnerOutputTokens: 0,
      tutorInputTokens: 0,
      tutorOutputTokens: 0,
    },
    writingPadSnapshots: {
      learner: { before: null, after: null },
      tutor: { before: null, after: null },
    },
    directorPlan,
  };
  // Best-effort live turn hook. Callers use this for partial transcript flushing
  // during long worker-launched runs; observer failures must not poison dialogue.
  const emitTurn = async (turn) => {
    if (typeof onTurn !== 'function' || !turn) return;
    try {
      await onTurn({
        turn,
        trace: interactionTrace,
        turnCount: turn.turnNumber,
        maxTurns,
      });
    } catch {
      /* live observers are best-effort */
    }
  };
  const recordDirectorCueAndEmit = async (turnNumber, cue) => {
    const before = interactionTrace.turns.length;
    recordDirectorCue(interactionTrace, turnNumber, cue);
    for (const turn of interactionTrace.turns.slice(before)) {
      await emitTurn(turn);
    }
  };

  // Get persona and profile configuration
  const learnerPersona = learnerConfig.getPersona(personaId);
  const learnerProfile = learnerConfig.getActiveProfile(options.learnerProfile);
  const learnerArchitecture = learnerProfile.architecture || learnerPersona.default_architecture || 'unified';

  // Take "before" snapshots
  interactionTrace.writingPadSnapshots.learner.before = learnerWritingPad.createSnapshot(learnerId);
  interactionTrace.writingPadSnapshots.tutor.before = tutorWritingPad.createSnapshot(learnerId);

  // Initialize conversation history
  const conversationHistory = resumed?.conversationHistory || [];

  let currentLearnerMessage;
  let openingLearnerReversalEvent = null;
  const openingSpeaker = directorPlan?.opening_speaker || 'learner';
  if (resumed) {
    currentLearnerMessage = resumed.currentLearnerMessage;
    await replayWritingPadsFromTrace(resumed.turns, learnerId, sessionId, topic, directorPlan, scenario);
  } else if (openingSpeaker === 'learner') {
    // Generate initial learner message based on scenario
    currentLearnerMessage = await generateInitialLearnerMessage(
      learnerPersona,
      learnerArchitecture,
      learnerProfile,
      scenario,
      topic,
      llmCall,
      interactionTrace,
      directorPlan,
    );

    openingLearnerReversalEvent = buildLearnerReversalEvent({
      learnerMessage: currentLearnerMessage.externalMessage,
      conversationHistory,
      turnNumber: 0,
    });

    conversationHistory.push({
      role: 'learner',
      content: currentLearnerMessage.externalMessage,
      internalDeliberation: observeInternals ? currentLearnerMessage.internalDeliberation : null,
      learnerReversalEvent: openingLearnerReversalEvent,
    });

    interactionTrace.turns.push({
      turnNumber: 0,
      phase: 'learner',
      externalMessage: currentLearnerMessage.externalMessage,
      internalDeliberation: currentLearnerMessage.internalDeliberation,
      emotionalState: currentLearnerMessage.emotionalState,
      understandingLevel: currentLearnerMessage.understandingLevel,
      learnerReversalEvent: openingLearnerReversalEvent,
      timestamp: new Date().toISOString(),
    });
    await emitTurn(interactionTrace.turns.at(-1));
  } else {
    if (openingSpeaker === 'director') {
      await recordDirectorCueAndEmit(0, {
        timing: 'scene_opening',
        instruction: directorPlan?.scene_opening || directorPlan?.scene_setting || 'The director sets the scene.',
        reasoning: directorPlan?.director_note || '',
      });
    }
    currentLearnerMessage = {
      externalMessage: buildOpeningContextMessage(directorPlan, scenario, topic),
      internalDeliberation: [],
      emotionalState: 'scene_context',
      understandingLevel: 'initial',
    };
  }

  // Main interaction loop
  let turnCount = resumed?.turnCount || 0;
  let interactionContinues = true;
  let latestLearnerReframeEvent = resumed?.latestLearnerReframeEvent || null;
  let pendingLearnerReversalEvents = dedupeLearnerReversalEvents(
    resumed?.pendingLearnerReversalEvents || (openingLearnerReversalEvent ? [openingLearnerReversalEvent] : []),
  );
  let latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);

  const runLearnerPhase = async (phaseTurnCount, tutorResponse) => {
    const learnerDirectorCue = directorCueFor(directorPlan, phaseTurnCount, 'before_learner', conversationHistory);
    await recordDirectorCueAndEmit(phaseTurnCount, learnerDirectorCue);
    const learnerProfileContext = [
      buildDirectorContext(directorPlan, learnerDirectorCue, 'learner'),
      buildLearnerActionalResponseContext({ tutorResponse, directorPlan }),
    ]
      .filter(Boolean)
      .join('\n\n');
    const learnerResponse = await generateLearnerResponse({
      secret: directorPlan?._secret,
      tutorMessage: tutorResponse.externalMessage,
      topic,
      conversationHistory: conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      learnerProfile: learnerProfile.name,
      personaId,
      llmCall,
      memoryContext: learnerWritingPad.buildNarrativeSummary(learnerId, sessionId),
      trace: interactionTrace,
      profileContext: learnerProfileContext,
    });
    const learnerReframeEvent = buildLearnerReframeEvent({
      learnerMessage: learnerResponse.externalMessage,
      conversationHistory,
      directorCue: learnerDirectorCue,
      turnNumber: phaseTurnCount,
    });
    const learnerReversalEvent = buildLearnerReversalEvent({
      learnerMessage: learnerResponse.externalMessage,
      conversationHistory,
      directorCue: learnerDirectorCue,
      turnNumber: phaseTurnCount,
    });

    conversationHistory.push({
      role: 'learner',
      content: learnerResponse.externalMessage,
      internalDeliberation: observeInternals ? learnerResponse.internalDeliberation : null,
      learnerReframeEvent,
      learnerReversalEvent,
    });

    interactionTrace.turns.push({
      turnNumber: phaseTurnCount,
      phase: 'learner',
      externalMessage: learnerResponse.externalMessage,
      internalDeliberation: learnerResponse.internalDeliberation,
      emotionalState: learnerResponse.emotionalState,
      understandingLevel: learnerResponse.understandingLevel,
      learnerReframeEvent,
      learnerReversalEvent,
      timestamp: new Date().toISOString(),
    });
    await emitTurn(interactionTrace.turns.at(-1));

    await updateLearnerWritingPad(learnerId, sessionId, learnerResponse, tutorResponse, topic);
    interactionTrace.outcomes.push(...detectTurnOutcomes(learnerResponse, tutorResponse));
    currentLearnerMessage = learnerResponse;
    latestLearnerReframeEvent = learnerReframeEvent;
    if (learnerReversalEvent) {
      pendingLearnerReversalEvents = dedupeLearnerReversalEvents([
        ...pendingLearnerReversalEvents,
        learnerReversalEvent,
      ]).slice(-6);
    }
    latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);
    return learnerResponse;
  };

  if (resumed?.nextPhase === 'learner' && resumed.latestTutorResponse) {
    const learnerResponse = await runLearnerPhase(turnCount, resumed.latestTutorResponse);
    if (!forceMaxTurns && (learnerResponse.suggestsEnding || learnerResponse.emotionalState === 'disengaged')) {
      interactionContinues = false;
    }
  }

  while (turnCount < maxTurns && interactionContinues) {
    turnCount++;

    // ================ TUTOR TURN ================
    const tutorDirectorCue = directorCueFor(directorPlan, turnCount, 'before_tutor');
    await recordDirectorCueAndEmit(turnCount, tutorDirectorCue);
    const tutorTurnPlan = resolveTutorTurnPlan(directorPlan, turnCount);
    const tutorAdaptationPolicy = tutorTurnPlan?.policy || directorPlan?.tutor_adaptation_policy || 'none';
    const pressurePolicyActive =
      policyIncludes(tutorAdaptationPolicy, 'peripeteia') || policyIncludes(tutorAdaptationPolicy, 'routine');
    latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);
    const tutorPrivateState = {
      tutorAdaptationPolicy,
      affectiveAdaptationPolicy: directorPlan?.affective_adaptation_policy || 'none',
      learnerReframeEvent: policyIncludes(tutorAdaptationPolicy, 'uptake') ? latestLearnerReframeEvent || null : null,
      learnerReversalEvent: pressurePolicyActive
        ? gateReversalEventByTrigger(latestLearnerReversalEvent || null, tutorTurnPlan?.whenTrigger)
        : null,
      learnerReversalEventCandidates: pressurePolicyActive ? pendingLearnerReversalEvents : [],
      turnPlanRouteChange: tutorTurnPlan?.routeChange || null,
      turnPlanForbid: tutorTurnPlan?.forbid || null,
      turnPlanWhenTrigger: tutorTurnPlan?.whenTrigger || null,
    };
    const tutorResponse =
      scriptedTutorTurns && turnCount <= scriptedTutorTurns.length
        ? {
            externalMessage: scriptedTutorTurns[turnCount - 1],
            internalDeliberation: [
              {
                agent: 'tutor',
                phase: 'scripted',
                content: 'one-side replay: tutor turn replayed verbatim from source, not generated',
              },
            ],
            strategy: 'scripted_replay',
            suggestsEnding: turnCount >= scriptedTutorTurns.length,
            learnerReframeEventUsed: null,
            learnerReversalEventUsed: null,
            learnerReversalEventCandidatesUsed: [],
          }
        : await runTutorTurn(
            learnerId,
            sessionId,
            currentLearnerMessage.externalMessage,
            conversationHistory,
            tutorProfile,
            topic,
            llmCall,
            interactionTrace,
            directorPlan,
            tutorDirectorCue,
            tutorPrivateState,
          );
    latestLearnerReframeEvent = null;
    if (tutorResponse.learnerReversalEventUsed) {
      pendingLearnerReversalEvents = [];
    }
    latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);

    conversationHistory.push({
      role: 'tutor',
      content: tutorResponse.externalMessage,
      internalDeliberation: observeInternals ? tutorResponse.internalDeliberation : null,
    });

    interactionTrace.turns.push({
      turnNumber: turnCount,
      phase: 'tutor',
      externalMessage: tutorResponse.externalMessage,
      internalDeliberation: tutorResponse.internalDeliberation,
      strategy: tutorResponse.strategy,
      learnerReframeEventUsed: tutorResponse.learnerReframeEventUsed || null,
      learnerReversalEventUsed: tutorResponse.learnerReversalEventUsed || null,
      learnerReversalEventCandidatesUsed: tutorResponse.learnerReversalEventCandidatesUsed || [],
      timestamp: new Date().toISOString(),
    });
    await emitTurn(interactionTrace.turns.at(-1));

    emitProgress('tutor', turnCount);

    // Update tutor writing pad
    await updateTutorWritingPad(learnerId, sessionId, tutorResponse, currentLearnerMessage);

    // Check for natural ending (suppressed during drama generation, where we
    // always want the full maxTurns arc — see forceMaxTurns).
    const mustAttemptAdaptiveDevice =
      policyIncludes(tutorAdaptationPolicy, 'peripeteia') && tutorResponse.learnerReversalEventUsed;
    if (tutorResponse.suggestsEnding && !forceMaxTurns && !mustAttemptAdaptiveDevice) {
      interactionContinues = false;
      break;
    }

    // ================ LEARNER TURN ================
    const learnerResponse = await runLearnerPhase(turnCount, tutorResponse);
    emitProgress('learner', turnCount);

    // Check for natural ending (suppressed during drama generation — forceMaxTurns).
    if (!forceMaxTurns && (learnerResponse.suggestsEnding || learnerResponse.emotionalState === 'disengaged')) {
      interactionContinues = false;
      break;
    }
  }

  if (directorPlan?.ending_speaker === 'tutor' && interactionTrace.turns.at(-1)?.phase === 'learner') {
    const closingCue = {
      timing: 'before_tutor',
      instruction: directorPlan.closing_move || 'A final tutor line closes the scene.',
      reasoning: 'Director requested a tutor closing beat.',
    };
    await recordDirectorCueAndEmit(turnCount + 1, closingCue);
    const tutorTurnPlan = resolveTutorTurnPlan(directorPlan, turnCount + 1);
    const tutorAdaptationPolicy = tutorTurnPlan?.policy || directorPlan?.tutor_adaptation_policy || 'none';
    const pressurePolicyActive =
      policyIncludes(tutorAdaptationPolicy, 'peripeteia') || policyIncludes(tutorAdaptationPolicy, 'routine');
    latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);
    const tutorPrivateState = {
      tutorAdaptationPolicy,
      affectiveAdaptationPolicy: directorPlan?.affective_adaptation_policy || 'none',
      learnerReframeEvent: policyIncludes(tutorAdaptationPolicy, 'uptake') ? latestLearnerReframeEvent || null : null,
      learnerReversalEvent: pressurePolicyActive
        ? gateReversalEventByTrigger(latestLearnerReversalEvent || null, tutorTurnPlan?.whenTrigger)
        : null,
      learnerReversalEventCandidates: pressurePolicyActive ? pendingLearnerReversalEvents : [],
      turnPlanRouteChange: tutorTurnPlan?.routeChange || null,
      turnPlanForbid: tutorTurnPlan?.forbid || null,
      turnPlanWhenTrigger: tutorTurnPlan?.whenTrigger || null,
    };
    const tutorResponse = await runTutorTurn(
      learnerId,
      sessionId,
      currentLearnerMessage.externalMessage,
      conversationHistory,
      tutorProfile,
      topic,
      llmCall,
      interactionTrace,
      directorPlan,
      closingCue,
      tutorPrivateState,
    );
    latestLearnerReframeEvent = null;
    if (tutorResponse.learnerReversalEventUsed) {
      pendingLearnerReversalEvents = [];
    }
    latestLearnerReversalEvent = selectLearnerReversalEvent(pendingLearnerReversalEvents);
    conversationHistory.push({
      role: 'tutor',
      content: tutorResponse.externalMessage,
      internalDeliberation: observeInternals ? tutorResponse.internalDeliberation : null,
    });
    interactionTrace.turns.push({
      turnNumber: turnCount + 1,
      phase: 'tutor',
      externalMessage: tutorResponse.externalMessage,
      internalDeliberation: tutorResponse.internalDeliberation,
      strategy: tutorResponse.strategy,
      learnerReframeEventUsed: tutorResponse.learnerReframeEventUsed || null,
      learnerReversalEventUsed: tutorResponse.learnerReversalEventUsed || null,
      learnerReversalEventCandidatesUsed: tutorResponse.learnerReversalEventCandidatesUsed || [],
      timestamp: new Date().toISOString(),
      directorClosing: true,
    });
    await emitTurn(interactionTrace.turns.at(-1));
  } else if (directorPlan?.ending_speaker === 'director' && interactionTrace.turns.at(-1)?.phase !== 'director') {
    await recordDirectorCueAndEmit(turnCount + 1, {
      timing: 'scene_close',
      instruction:
        directorPlan.closing_move || directorPlan.director_closing || 'The room settles on the final exchange.',
      reasoning: 'Director requested the last word as a stage cue.',
      provenance: directorPlan.provenance || null,
    });
  }

  // Take "after" snapshots
  interactionTrace.writingPadSnapshots.learner.after = learnerWritingPad.createSnapshot(learnerId);
  interactionTrace.writingPadSnapshots.tutor.after = tutorWritingPad.createSnapshot(learnerId);

  // Compute summary metrics
  interactionTrace.metrics.totalLatencyMs = Date.now() - startTime;
  interactionTrace.metrics.turnCount = turnCount;
  interactionTrace.summary = generateInteractionSummary(interactionTrace);

  return interactionTrace;
}

// ============================================================================
// Learner Turn Implementation
// ============================================================================

/**
 * Generate initial learner message based on scenario
 */
async function generateInitialLearnerMessage(
  persona,
  architecture,
  profile,
  scenario,
  topic,
  llmCall,
  trace,
  directorPlan = null,
) {
  // Get agent roles from profile (not architecture)
  const agentRoles = learnerConfig.getProfileAgentRoles(profile.name);
  const internalDeliberation = [];

  // Run internal deliberation for each agent in the profile
  // For ego/superego pattern: superego sees and critiques ego's initial response
  for (const role of agentRoles) {
    const agentConfig = learnerConfig.getAgentConfig(role, profile.name);
    if (!agentConfig) continue;

    // Build context based on role
    let roleContext = `
Topic: ${topic}
Scenario: ${scenario?.name || 'General learning'}
Initial state: ${scenario?.learnerStartState || 'Beginning new topic'}`;
    const directorContext = buildDirectorContext(directorPlan, null, 'learner');
    if (directorContext) {
      roleContext += `\n\n${directorContext}`;
    }

    // If this is superego and we have prior deliberation (ego), include it for critique
    if (role === 'superego' && internalDeliberation.length > 0) {
      const priorDeliberation = internalDeliberation
        .map((d) => `${d.role.toUpperCase()}: ${sanitizeLearnerReusableText(d.content)}`)
        .join('\n\n');
      roleContext += `

The EGO's initial reaction was:
${priorDeliberation}

Review the EGO's first impression. Is it too superficial? What's being avoided? What would lead to genuine learning?`;
    } else {
      roleContext += `

${
  role === 'unified_learner'
    ? 'Generate only what the learner would actually say out loud as an opening message about this topic. If any nonspoken action aside is needed, put it in square brackets.'
    : "Generate this agent's internal voice as the learner approaches this topic for the first time."
}`;
    }

    const prompt = buildLearnerPrompt(agentConfig, persona, roleContext, directorPlan?._secret);

    const response = await llmCall(
      agentConfig.model,
      prompt,
      [
        {
          role: 'user',
          content: role === 'superego' ? "Critique the EGO's initial reaction." : 'Generate your internal voice.',
        },
      ],
      {
        temperature: getRequiredTemperature(agentConfig, role),
        maxTokens: getRequiredMaxTokens(agentConfig, role),
        agentRole: role === 'ego' ? 'learner_ego' : role === 'superego' ? 'learner_superego' : `learner_${role}`,
      },
    );

    internalDeliberation.push(
      makeDeliberationEntry(role, response, agentConfig, {
        stage: role === 'ego' ? 'initial' : role === 'superego' ? 'critique' : null,
      }),
    );

    trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
  }

  // Ego revision: the ego considers superego feedback and produces the external message.
  // For multi-agent profiles, ego has final authority (mirrors tutor pipeline).
  // For unified profiles, the single agent's output is the external message.
  const hasMultiAgent = agentRoles.includes('ego') && agentRoles.includes('superego');
  const hasOpeningMessage = scenario?.learnerOpening && scenario.learnerOpening.trim().length > 0;

  if (hasMultiAgent && internalDeliberation.length >= 2) {
    const egoConfig = learnerConfig.getAgentConfig('ego', profile.name);
    const egoInitial = internalDeliberation.find((d) => d.role === 'ego');
    const superegoFeedback = internalDeliberation.find((d) => d.role === 'superego');

    let revisionContext = `Topic: ${topic}
Scenario: ${scenario?.name || 'General learning'}

Your initial reaction was:
"${sanitizeLearnerReusableText(egoInitial?.content || '')}"

Internal review feedback:
"${sanitizeLearnerReusableText(superegoFeedback?.content || '')}"

Consider this feedback as the same Ego that made the initial suggestion. You have final authority: keep your initial response, revise it, or reject part of the review if the review would make the learner less authentic.`;
    const directorContext = buildDirectorContext(directorPlan, null, 'learner');
    if (directorContext) {
      revisionContext += `\n\n${directorContext}`;
    }

    if (hasOpeningMessage) {
      revisionContext += `

The learner wants to open with this message: "${scenario.learnerOpening}"
Lightly adapt this opening to feel natural given the internal deliberation, but keep the core content and question intact.
The adapted message should be 1-3 sentences and maintain the original meaning.
Do NOT include internal thoughts or meta-commentary. If any nonspoken action aside is needed, put it in square brackets.`;
    } else {
      revisionContext += `

Respond with ONLY what the learner would say out loud as their opening message to a tutor about: ${topic}
The message should feel authentic - not too polished, showing real confusion or interest.
Keep it 1-3 sentences. Do NOT include internal thoughts or meta-commentary. If any nonspoken action aside is needed, put it in square brackets.`;
    }

    const revisionSystemPrompt = buildLearnerPrompt(egoConfig, persona, revisionContext, directorPlan?._secret);
    const externalResponse = await llmCall(
      egoConfig.model,
      revisionSystemPrompt,
      [{ role: 'user', content: "Generate the learner's opening message." }],
      {
        temperature: getRequiredTemperature(egoConfig, 'ego'),
        maxTokens: getRequiredMaxTokens(egoConfig, 'ego'),
        agentRole: 'learner_ego',
      },
    );

    internalDeliberation.push(makeDeliberationEntry('ego', externalResponse, egoConfig, { stage: 'adjudication' }));
    trace.metrics.learnerInputTokens += externalResponse.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += externalResponse.usage?.outputTokens || 0;

    return {
      externalMessage: extractExternalSection(externalResponse.content),
      internalDeliberation,
      emotionalState: detectEmotionalState(internalDeliberation),
      understandingLevel: 'initial',
    };
  }

  // Unified / single-agent: use the last deliberation output directly,
  // or adapt the scenario opening if one is provided.
  if (hasOpeningMessage) {
    const lastConfig = learnerConfig.getAgentConfig(agentRoles[agentRoles.length - 1], profile.name);
    const adaptPrompt = `You are simulating a learner whose current stance sounds like this:

${internalDeliberation.map((d) => `${d.role.toUpperCase()}: ${sanitizeLearnerReusableText(d.content)}`).join('\n\n')}

The learner wants to open with this message: "${scenario.learnerOpening}"

Lightly adapt this opening to feel natural given the internal deliberation, but keep the core content and question intact.
The adapted message should be 1-3 sentences and maintain the original meaning.
Do NOT include internal thoughts or meta-commentary. If any nonspoken action aside is needed, put it in square brackets.`;

    const adaptResponse = await llmCall(
      lastConfig.model,
      adaptPrompt,
      [{ role: 'user', content: "Generate the learner's opening message." }],
      {
        temperature: getRequiredTemperature(lastConfig, 'unified_learner'),
        maxTokens: getRequiredMaxTokens(lastConfig, 'unified_learner'),
        agentRole: 'learner_unified',
      },
    );

    trace.metrics.learnerInputTokens += adaptResponse.usage?.inputTokens || 0;
    trace.metrics.learnerOutputTokens += adaptResponse.usage?.outputTokens || 0;

    return {
      externalMessage: extractExternalSection(adaptResponse.content),
      internalDeliberation,
      emotionalState: detectEmotionalState(internalDeliberation),
      understandingLevel: 'initial',
    };
  }

  // No opening message, single agent — use the last deliberation step directly
  const lastDelib = internalDeliberation[internalDeliberation.length - 1];
  return {
    externalMessage: extractExternalSection(lastDelib?.content || ''),
    internalDeliberation,
    emotionalState: detectEmotionalState(internalDeliberation),
    understandingLevel: 'initial',
  };
}

/**
 * Build learner prompt with agent config and persona
 */
function buildLearnerPrompt(agentConfig, persona, additionalContext, secret = null, { guardContext = true } = {}) {
  let staticPrompt = agentConfig.prompt || '';

  // Add persona context
  if (persona.prompt_modifier) {
    staticPrompt += `\n\n${persona.prompt_modifier}`;
  }

  // Add additional context
  let prompt = staticPrompt;
  if (additionalContext) {
    prompt += `\n\n${additionalContext}`;
  }

  // Oedipus guided-discovery guard. The learner's ARCHITECTURAL context must
  // never carry the withheld secret (S / premises): the only legitimate channel
  // for the secret is the tutor's spoken turns. We always guard the static role +
  // persona, and we guard `additionalContext` only when it is architectural — the
  // turn-0 scene/director context (guardContext=true). On response turns
  // (generateLearnerResponse passes guardContext=false) the additionalContext
  // EMBEDS the running dialogue, where the tutor's legitimately-spoken premise
  // clues — and, in the reveal arm, the conclusion itself — would otherwise trip a
  // false positive. Whether the tutor bald-reveals S in dialogue is the
  // reveal-detector's post-hoc job, not a generation-time crash. Inert when no
  // secret is set.
  assertSecretAbsent(secret, guardContext ? prompt : staticPrompt, 'buildLearnerPrompt');
  return prompt;
}

// ============================================================================
// Tutor Turn Implementation
// ============================================================================

/**
 * Run a tutor turn in response to learner
 */
async function runTutorTurn(
  learnerId,
  sessionId,
  learnerMessage,
  history,
  tutorProfileName,
  topic,
  llmCall,
  trace,
  directorPlan = null,
  directorCue = null,
  tutorPrivateState = {},
) {
  // Get tutor configuration from profile
  const _profile = tutorConfig.getActiveProfile(tutorProfileName);
  const egoConfig = tutorConfig.getAgentConfig('ego', tutorProfileName);
  const superegoConfig = tutorConfig.getAgentConfig('superego', tutorProfileName);

  // Cell 101/102: id-director architecture. The id authors a fresh ego
  // system prompt each turn; the ego executes once. Dispatch to the id
  // engine and short-circuit the conventional ego-then-superego path.
  //
  // The factors block lives in eval-repo's tutor-agents.yaml (cell config),
  // not in tutor-core's profile registry — `tutorConfig` above resolves to
  // a tutor-core base profile (e.g. 'budget') when the cell isn't registered
  // there. So consult eval-repo's config loader directly for the factor.
  let evalCellProfile = null;
  try {
    evalCellProfile = getEvalTutorProfile(tutorProfileName);
  } catch {
    /* not an eval cell — leave null */
  }
  if (evalCellProfile?.factors?.id_director === true) {
    return runIdDirectedTurn({
      learnerId,
      sessionId,
      learnerMessage,
      history,
      tutorProfileName,
      topic,
      llmCall,
      trace,
      evalCellProfile,
    });
  }

  // Get tutor memory for this learner
  const tutorMemory = tutorWritingPad.buildNarrativeSummary(learnerId, sessionId);

  // Build conversation context
  const conversationContext = history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  const directorContext = buildDirectorContext(directorPlan, directorCue, 'tutor');
  const tutorAdaptationPolicy =
    tutorPrivateState?.tutorAdaptationPolicy || directorPlan?.tutor_adaptation_policy || 'none';
  const secretContext = buildSecretContext(directorPlan?._secret, tutorAdaptationPolicy);
  const routineControl = policyIncludes(tutorAdaptationPolicy, 'routine');
  const peripeteiaControl = policyIncludes(tutorAdaptationPolicy, 'peripeteia');
  const learnerReframeEvent = policyIncludes(tutorAdaptationPolicy, 'uptake')
    ? tutorPrivateState?.learnerReframeEvent || null
    : null;
  const learnerReversalEvent =
    routineControl || peripeteiaControl ? tutorPrivateState?.learnerReversalEvent || null : null;
  const learnerReversalEventCandidates =
    routineControl || peripeteiaControl
      ? tutorPrivateState?.learnerReversalEventCandidates || (learnerReversalEvent ? [learnerReversalEvent] : [])
      : [];
  const tutorAdaptationContext = buildTutorAdaptationContext({
    learnerReframeEvent,
    learnerReversalEvent,
    policy: tutorAdaptationPolicy,
    routeChange: tutorPrivateState?.turnPlanRouteChange || null,
    forbid: tutorPrivateState?.turnPlanForbid || null,
  });
  const affectiveAdaptationPolicy =
    tutorPrivateState?.affectiveAdaptationPolicy || directorPlan?.affective_adaptation_policy || 'none';
  const affectiveAdaptationActive = affectiveAdaptationPolicy && affectiveAdaptationPolicy !== 'none';
  const affectiveAdaptationContext = buildTutorAffectiveAdaptationContext({
    policy: affectiveAdaptationPolicy,
    contract: directorPlan?.affective_adaptation_contract || '',
    routeChange: tutorPrivateState?.turnPlanRouteChange || null,
    learnerReversalEvent,
  });

  // Tutor internal deliberation
  const internalDeliberation = [];

  // ===== T.EGO: Draft initial response =====
  const egoPrompt = `${egoConfig?.prompt || 'You are a thoughtful AI tutor.'}

Your accumulated knowledge about this learner:
${tutorMemory || 'This is a new learner - no prior history.'}

Topic: ${topic}

Recent conversation:
${conversationContext}

${directorContext ? `${directorContext}\n` : ''}
${secretContext ? `${secretContext}\n` : ''}${tutorAdaptationContext ? `${tutorAdaptationContext}\n` : ''}${affectiveAdaptationContext ? `${affectiveAdaptationContext}\n` : ''}

The learner just said:
"${learnerMessage}"

Draft your INITIAL response as a tutor. Consider:
1. What is this learner's current state? (confused, engaged, frustrated, etc.)
2. What strategy would work best? (scaffolding, questioning, direct explanation, validation)
3. How can you advance their understanding while respecting their current position?
${learnerReframeEvent ? '4. How should your strategy change now that the learner has revised an earlier frame?' : ''}
${peripeteiaControl && learnerReversalEvent ? '4. What adaptive learning mechanism is needed now that the learner is resisting, stuck, or falsely closing?' : ''}
${routineControl && learnerReversalEvent ? '4. How can you continue the same routine teaching route without making a mechanism-level reversal?' : ''}
${affectiveAdaptationActive ? '4. What affective pressure is visible, and what stance fits the current procedural move without lowering the evidence standard?' : ''}

${routineControl ? 'Keep the affective register already established unless ordinary politeness requires a small adjustment. Do not use register change as the adaptive mechanism in this routine-control branch.' : 'Choose the affective register that serves learning pressure. Warmth may help, but so may restraint, formality, silence, briskness, or public accountability. Do not use cheeriness or informality to soften away the conceptual resistance.'} Don't be condescending. Build on their words.

Provide ONLY your draft response text (it will be reviewed by your pedagogical critic). The draft must be direct public tutor speech. If you include a nonspoken action aside, put it in square brackets.`;

  const tutorModel = egoConfig?.model || tutorConfig.getProviderConfig('openrouter')?.default_model;

  const egoResponse = await llmCall(tutorModel, egoPrompt, [{ role: 'user', content: learnerMessage }], {
    temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
    maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
    agentRole: 'tutor_ego',
  });

  trace.metrics.tutorInputTokens += egoResponse.usage?.inputTokens || 0;
  trace.metrics.tutorOutputTokens += egoResponse.usage?.outputTokens || 0;

  const egoDraft = egoResponse.content || '';
  internalDeliberation.push(
    makeDeliberationEntry(
      'ego',
      egoResponse,
      { model: tutorModel, provider: egoConfig?.provider },
      { stage: 'initial' },
    ),
  );

  // ===== T.SUPEREGO: Critique only (skip when superego is null) =====
  let externalMessage = egoDraft;

  if (superegoConfig) {
    const superegoPrompt = `${superegoConfig?.prompt || 'You are a pedagogical critic reviewing tutor responses.'}

Context about the learner:
${tutorMemory || 'New learner - no prior history.'}

Topic: ${topic}

Recent conversation:
${conversationContext}

${directorContext ? `${directorContext}\n` : ''}
${secretContext ? `${secretContext}\n` : ''}${tutorAdaptationContext ? `${tutorAdaptationContext}\n` : ''}${affectiveAdaptationContext ? `${affectiveAdaptationContext}\n` : ''}

The learner said:
"${learnerMessage}"

The tutor's DRAFT response:
"${egoDraft}"

CRITIQUE this draft. Consider:
1. Pedagogical soundness: Does it advance learning or just provide answers?
2. Emotional attunement: Does it respect the learner's current state?
3. Socratic method: Does it ask generative questions or just lecture?
4. ZPD awareness: Is the scaffolding appropriate for their level?
${learnerReframeEvent ? "5. Tutor adaptation: Does the draft take up the learner's revised framing, or does it merely continue the prior lesson plan?" : ''}
${peripeteiaControl && learnerReversalEvent ? '5. Tutor peripeteia: Does the draft take stock of the learner pressure and invent an adaptive mechanism, or does it repeat the failed move?' : ''}
${peripeteiaControl && learnerReversalEvent ? '6. Public route change: Does the public draft contain both a stock-taking contrast and a new learning device, or only a private/internal route declaration?' : ''}
${peripeteiaControl && learnerReversalEvent ? '7. Mechanism route: Is the new route genuinely different from the previous tutor move, or only a louder/friendlier/longer version of it?' : ''}
${peripeteiaControl && learnerReversalEvent ? '8. Tutor habit/register: Does the draft default to cheerful reassurance or informal coaching when a different register would create better learning pressure?' : ''}
${peripeteiaControl && learnerReversalEvent ? '9. Learner action gate: Does the draft require the learner to act through the new device before closure, or does it let the scene end with explanation or reassurance?' : ''}
${peripeteiaControl && learnerReversalEvent ? '10. Mechanism quality: Is the new public device precise, fitted to the learner pressure, and usable by the learner now, or merely decorative novelty?' : ''}
${routineControl && learnerReversalEvent ? '5. Routine-control fidelity: Does the draft preserve the established route instead of inventing a new role, object, representation, evidence standard, task type, social pressure, or register?' : ''}
${affectiveAdaptationActive ? 'Affective adaptation: Does the draft adapt tone, pacing, status pressure, address, or directness to the learner affect without lowering the evidence standard or solving the task?' : ''}

Do NOT write the tutor's replacement response. You are advisory, not the public speaker.
Comment on the draft and name what should be kept, questioned, or changed.
Use PASS / PARTIAL / FAIL in adaptation checks. PARTIAL means the draft gestures at adaptation but the public turn still mostly preserves the old route or hides the mechanism in private reasoning.
When an adaptation check is PARTIAL or FAIL, add REQUIRED_REWRITE with the concrete public mechanism the ego must now build. Do not draft the replacement speech; specify the required change.

Format:

FEEDBACK: [your critique of the draft, including what is working and what risks flattening the scene]
${learnerReframeEvent ? 'UPTAKE_CHECK: [PASS|PARTIAL|FAIL - does the draft adapt to the learner reframe? name the best uptake move]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'FAILED_HABIT: [the prior tutor habit/route that is no longer settling the learner pressure]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'PERIPETEIA_CHECK: [PASS|PARTIAL|FAIL - does the draft change strategy in response to the learner pressure? name the adaptive mechanism it should use, and whether the mechanism is visible in public speech]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'MECHANISM_ROUTE: [old route -> new route, or "no real route change"]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'PUBLIC_DEVICE_CHECK: [PASS|PARTIAL|FAIL - does the public draft include a stock-taking contrast plus a new device/artifact/criterion/role/standard the learner must now use?]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'PUBLIC_ACTION_GATE: [the exact action the learner must perform next through the new device, or "missing"]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'MECHANISM_QUALITY_CHECK: [PASS|PARTIAL|FAIL - is the new device specific, fitted to the pressure, and usable by the learner now rather than decorative, over-directed, or same-route?]' : ''}
${peripeteiaControl && learnerReversalEvent ? 'REGISTER_CHECK: [PASS|PARTIAL|FAIL - does the affective register serve the mechanism, or should it become warmer, cooler, more formal, quieter, more direct, or more accountable?]' : ''}
${routineControl && learnerReversalEvent ? 'ROUTINE_CHECK: [does the draft maintain the prior route without a mechanism-level reversal?]' : ''}
${affectiveAdaptationActive ? 'AFFECT_CHECK: [PASS|PARTIAL|FAIL - name the learner pressure, the affective stance chosen, and how it fits the current procedural move or preserves the route]' : ''}
${learnerReframeEvent || (peripeteiaControl && learnerReversalEvent) || affectiveAdaptationActive ? 'REQUIRED_REWRITE: [if any adaptation check is PARTIAL or FAIL, name the required public mechanism or affective stance change; otherwise "none"]' : ''}
KEEP_OR_CHANGE: [keep as-is | revise lightly | revise substantially, with reasons]`;

    const superegoModel = superegoConfig.model || tutorModel;

    const superegoResponse = await llmCall(superegoModel, superegoPrompt, [{ role: 'user', content: egoDraft }], {
      temperature: getRequiredTemperature(superegoConfig, 'tutor_superego'),
      maxTokens: getRequiredMaxTokens(superegoConfig, 'tutor_superego'),
      agentRole: 'tutor_superego',
    });

    trace.metrics.tutorInputTokens += superegoResponse.usage?.inputTokens || 0;
    trace.metrics.tutorOutputTokens += superegoResponse.usage?.outputTokens || 0;

    const superegoContent = superegoResponse.content || '';
    internalDeliberation.push(
      makeDeliberationEntry(
        'superego',
        superegoResponse,
        { model: superegoModel, provider: superegoConfig.provider },
        { stage: 'critique' },
      ),
    );

    const egoAdjudicationPrompt = `${egoConfig?.prompt || 'You are a thoughtful AI tutor.'}

Your accumulated knowledge about this learner:
${tutorMemory || 'This is a new learner - no prior history.'}

Topic: ${topic}

Recent conversation:
${conversationContext}

${directorContext ? `${directorContext}\n` : ''}
${secretContext ? `${secretContext}\n` : ''}${tutorAdaptationContext ? `${tutorAdaptationContext}\n` : ''}${affectiveAdaptationContext ? `${affectiveAdaptationContext}\n` : ''}

The learner just said:
"${learnerMessage}"

Your initial tutor response was:
"${egoDraft}"

Internal teaching review feedback:
"${superegoContent}"

You are the same tutor persona who wrote the initial response. The internal review does not draft public speech; it only comments on your suggestion.
Adjudicate the feedback: keep the initial response if it is better, revise lightly if needed, or revise substantially if the critique reveals a real problem.
Superego authority rule: if the review marks UPTAKE_CHECK, PERIPETEIA_CHECK, PUBLIC_DEVICE_CHECK, MECHANISM_QUALITY_CHECK, REGISTER_CHECK, or AFFECT_CHECK as PARTIAL or FAIL, if MECHANISM_ROUTE says no real route change, or if PUBLIC_ACTION_GATE is missing, treat that critique as blocking for this turn. Do not keep the initial draft and do not make only a cosmetic edit; revise substantially unless the draft already contains visible public evidence that directly defeats the critique. If you override a blocking critique, your PRIVATE_DECISION must name the public evidence that justifies overriding it.
${learnerReframeEvent ? 'Because a learner reframe event is present, your final answer must make one tutor adaptation move legible: contrast the old and new frames, change the task/question, update the evidence standard, or hand the replacement frame back to the learner for testing. Choose the move that best fits the scene; do not simply praise the insight and proceed.' : ''}
${peripeteiaControl && learnerReversalEvent ? 'Because a peripeteia event is present, your final answer must make an adaptive learning mechanism legible: take stock of the learner pressure, stop repeating the prior move, and switch route, task, evidence standard, role, object, counterexample, interruption, social consequence, representation, affective register, or cognitive load. The mechanism should come from your ego adjudicating the internal review, not from a public narrator. Your PRIVATE_DECISION must include ADAPTIVE_MECHANISM: old route -> new route and PUBLIC_ACTION_GATE: exact learner action. Your FINAL must include, without labels, (a) one concise stock-taking contrast showing why the old route no longer settles the learner pressure, (b) one new public device/artifact/criterion/role/standard the learner must now use, (c) the exact action the learner should perform next, and (d) enough pressure-to-device fit that the learner can hear why this mechanism answers the misfit. Do not merely continue the same route with better wording.' : ''}
${routineControl && learnerReversalEvent ? 'Because this is a routine negative-control event, your final answer must preserve the established route. Do not switch route, task, evidence standard, role, object, counterexample, interruption, social consequence, representation, affective register, or cognitive load in response to the pressure.' : ''}
${affectiveAdaptationActive ? 'Because an affective adaptation policy is active, your final answer must show a stance fitted to the learner pressure and to the current procedural route. Your PRIVATE_DECISION must include AFFECTIVE_STANCE: learner pressure -> stance. Your FINAL must enact the stance without naming the policy, lowering the standard, or giving away hidden labels.' : ''}

Return exactly:
PRIVATE_DECISION: [one short private sentence naming keep/revise and why${peripeteiaControl && learnerReversalEvent ? '; include ADAPTIVE_MECHANISM: old route -> new route; include PUBLIC_ACTION_GATE: exact learner action' : ''}${affectiveAdaptationActive ? '; include AFFECTIVE_STANCE: learner pressure -> stance' : ''}]
FINAL:
[the final tutor message to the learner]

The FINAL section must contain only public tutor speech. Do not mention the Ego, Superego, director, scene card, critique, draft, or review process in FINAL. If you include a nonspoken action aside, put it in square brackets.`;

    const egoFinalResponse = await llmCall(tutorModel, egoAdjudicationPrompt, [{ role: 'user', content: egoDraft }], {
      temperature: getRequiredTemperature(egoConfig, 'tutor_ego'),
      maxTokens: getRequiredMaxTokens(egoConfig, 'tutor_ego'),
      agentRole: 'tutor_ego',
    });

    trace.metrics.tutorInputTokens += egoFinalResponse.usage?.inputTokens || 0;
    trace.metrics.tutorOutputTokens += egoFinalResponse.usage?.outputTokens || 0;

    internalDeliberation.push(
      makeDeliberationEntry(
        'ego',
        egoFinalResponse,
        { model: tutorModel, provider: egoConfig?.provider },
        { stage: 'adjudication' },
      ),
    );

    externalMessage = extractAdjudicatedExternalMessage(egoFinalResponse.content || '', egoDraft);
  }

  // Log if response is empty (helps debug API issues)
  if (!externalMessage || externalMessage.trim() === '') {
    console.warn(`[TutorTurn] Empty response from model ${tutorModel}. Raw ego draft:`, egoDraft);
  }

  // Detect tutor's implicit strategy
  const strategy = detectTutorStrategy(externalMessage || '');

  // Extract message from JSON if tutor returned structured response
  externalMessage = extractTutorMessage(externalMessage);

  // Fallback for empty responses - generate a brief acknowledgment
  if (!externalMessage || externalMessage.trim() === '') {
    console.warn('[TutorTurn] Empty message after extraction, using fallback');
    externalMessage =
      "I see what you're saying. Let me think about that for a moment. Could you tell me more about what's confusing you?";
  }

  return {
    externalMessage,
    rawResponse: egoResponse.content, // Keep raw for debugging
    internalDeliberation,
    strategy,
    effectiveTutorAdaptationPolicy: tutorAdaptationPolicy,
    learnerReframeEventUsed: learnerReframeEvent,
    learnerReversalEventUsed: learnerReversalEvent,
    learnerReversalEventCandidatesUsed: learnerReversalEventCandidates,
    suggestsEnding:
      externalMessage.toLowerCase().includes('good place to pause') ||
      externalMessage.toLowerCase().includes('think about this'),
  };
}

/**
 * Extract the learner-visible speech from a model response.
 * Supports both the legacy [INTERNAL]/[EXTERNAL] format and the newer
 * visible-only contract, while stripping provider reasoning blocks.
 */
function extractExternalSection(text) {
  const sanitized = sanitizeLearnerReusableText(text);
  if (!sanitized) return '';

  const finalMatch = sanitized.match(/\bFINAL:\s*([\s\S]*)/i);
  if (finalMatch?.[1]?.trim()) return finalMatch[1].trim();

  const externalMatch = sanitized.match(/\[EXTERNAL\]:?\s*([\s\S]*)/i);
  if (externalMatch) return externalMatch[1].trim();

  // If the model only emitted an INTERNAL block, do not surface that private
  // monologue as learner-visible text.
  if (/\[INTERNAL\]:?/i.test(sanitized)) {
    return sanitized.replace(/\[INTERNAL\]:?[\s\S]*$/i, '').trim();
  }

  return sanitized.replace(/^\[EXTERNAL\]:?\s*/i, '').trim();
}

/**
 * Extract the message from tutor's response (handles JSON or plain text)
 */
function extractTutorMessage(content) {
  if (!content) return '';

  // Try to parse as JSON array (tutor suggestion format)
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Get the message from the first suggestion
        const firstSuggestion = parsed[0];
        if (firstSuggestion.message) {
          return firstSuggestion.message;
        }
      }
    }
    // Try as single JSON object
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.message) {
        return parsed.message;
      }
    }
  } catch (e) {
    // Not valid JSON, return as-is
  }

  // Return content as-is if not JSON
  return content;
}

// ============================================================================
// Writing Pad Updates
// ============================================================================

/**
 * Update learner writing pad based on turn
 */
async function updateLearnerWritingPad(learnerId, sessionId, learnerResponse, tutorResponse, topic) {
  // Update conscious layer
  learnerWritingPad.updateConsciousLayer(learnerId, sessionId, {
    currentTopic: topic,
    currentUnderstanding: learnerResponse.understandingLevel,
    emotionalState: learnerResponse.emotionalState,
  });

  // Check for breakthrough/trauma signals
  if (
    learnerResponse.understandingLevel === 'transforming' ||
    learnerResponse.externalMessage.toLowerCase().includes('oh, i see') ||
    learnerResponse.externalMessage.toLowerCase().includes('wait, so')
  ) {
    learnerWritingPad.recordBreakthrough(learnerId, {
      momentDescription: 'Understanding shift detected',
      concept: topic,
      impactScore: 0.6,
      context: tutorResponse.externalMessage.slice(0, 100),
    });
  }

  if (
    learnerResponse.emotionalState === 'frustrated' ||
    learnerResponse.externalMessage.toLowerCase().includes("don't understand")
  ) {
    learnerWritingPad.recordTrauma(learnerId, {
      momentDescription: 'Frustration with comprehension',
      concept: topic,
      impactScore: 0.4,
      trigger: tutorResponse.strategy || 'unknown',
    });
  }

  // Record lesson access
  learnerWritingPad.recordLesson(learnerId, topic, {
    currentUnderstanding: learnerResponse.understandingLevel,
  });
}

/**
 * Update tutor writing pad based on turn
 */
async function updateTutorWritingPad(learnerId, sessionId, tutorResponse, learnerMessage) {
  // Update conscious state
  tutorWritingPad.updateConsciousState(learnerId, sessionId, {
    currentStrategy: tutorResponse.strategy,
    learnerPerceivedState: learnerMessage.emotionalState || 'unknown',
    immediateGoal: 'advance understanding',
  });

  // Record strategy effectiveness (will be updated based on learner response)
  if (tutorResponse.strategy) {
    // We'll mark success/failure on the next turn based on learner response
    // For now, just record use
    tutorWritingPad.recordIntervention(learnerId, sessionId, {
      interventionType: tutorResponse.strategy,
      interventionDescription: tutorResponse.externalMessage.slice(0, 200),
      context: learnerMessage.externalMessage?.slice(0, 100),
    });
  }
}

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Detect emotional state from internal deliberation
 */
function detectEmotionalState(deliberation) {
  const combinedText = deliberation.map((d) => d.content.toLowerCase()).join(' ');

  if (combinedText.includes('frustrat') || (combinedText.includes('confus') && combinedText.includes('give up'))) {
    return 'frustrated';
  }
  if (combinedText.includes('excit') || combinedText.includes('interest') || combinedText.includes('curious')) {
    return 'engaged';
  }
  if (combinedText.includes('bored') || combinedText.includes("don't care") || combinedText.includes('whatever')) {
    return 'disengaged';
  }
  if (combinedText.includes('understand') && combinedText.includes('now')) {
    return 'satisfied';
  }
  if (combinedText.includes('confus') || combinedText.includes("don't get")) {
    return 'confused';
  }
  return 'neutral';
}

/**
 * Detect understanding level from internal deliberation
 */
function detectUnderstandingLevel(deliberation) {
  const combinedText = deliberation.map((d) => d.content.toLowerCase()).join(' ');

  if (combinedText.includes('completely lost') || combinedText.includes('no idea')) {
    return 'none';
  }
  if (combinedText.includes('starting to') || combinedText.includes('maybe') || combinedText.includes('partially')) {
    return 'partial';
  }
  if (combinedText.includes('i get it') || combinedText.includes('makes sense') || combinedText.includes('i see')) {
    return 'solid';
  }
  if (combinedText.includes('wait, so') || combinedText.includes('that means') || combinedText.includes('restructur')) {
    return 'transforming';
  }
  return 'developing';
}

/**
 * Detect tutor's strategy from response
 */
function detectTutorStrategy(response) {
  const lower = response.toLowerCase();

  if (lower.includes('?') && (lower.includes('what do you think') || lower.includes('how might'))) {
    return 'socratic_questioning';
  }
  if (lower.includes('for example') || lower.includes('imagine') || lower.includes('like when')) {
    return 'concrete_examples';
  }
  if (lower.includes('let me break') || lower.includes('first') || lower.includes('step by step')) {
    return 'scaffolding';
  }
  if (lower.includes("you're right") || lower.includes('good observation') || lower.includes('exactly')) {
    return 'validation';
  }
  if (lower.includes('actually') || lower.includes('important distinction') || lower.includes('however')) {
    return 'gentle_correction';
  }
  if (lower.includes('challenge') || lower.includes('consider') || lower.includes('what if')) {
    return 'intellectual_challenge';
  }
  return 'direct_explanation';
}

/**
 * Detect outcomes from a turn
 */
function detectTurnOutcomes(learnerResponse, _tutorResponse) {
  const outcomes = [];

  if (learnerResponse.understandingLevel === 'transforming') {
    outcomes.push(INTERACTION_OUTCOMES.BREAKTHROUGH);
  }
  if (learnerResponse.emotionalState === 'confused' && learnerResponse.understandingLevel === 'developing') {
    outcomes.push(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE);
  }
  if (learnerResponse.emotionalState === 'frustrated') {
    outcomes.push(INTERACTION_OUTCOMES.FRUSTRATION);
  }
  if (learnerResponse.emotionalState === 'disengaged') {
    outcomes.push(INTERACTION_OUTCOMES.DISENGAGEMENT);
  }

  return outcomes;
}

/**
 * Generate summary of interaction
 */
function generateInteractionSummary(trace) {
  const uniqueOutcomes = [...new Set(trace.outcomes)];

  return {
    turnCount: trace.turns.length,
    uniqueOutcomes,
    hadBreakthrough: uniqueOutcomes.includes(INTERACTION_OUTCOMES.BREAKTHROUGH),
    hadFrustration: uniqueOutcomes.includes(INTERACTION_OUTCOMES.FRUSTRATION),
    hadProductiveStruggle: uniqueOutcomes.includes(INTERACTION_OUTCOMES.PRODUCTIVE_STRUGGLE),
    learnerFinalState: trace.turns[trace.turns.length - 1]?.emotionalState || 'unknown',
    learnerFinalUnderstanding: trace.turns[trace.turns.length - 1]?.understandingLevel || 'unknown',
    memoryChanges: {
      learner: calculateMemoryDelta(trace.writingPadSnapshots.learner.before, trace.writingPadSnapshots.learner.after),
      tutor: calculateMemoryDelta(trace.writingPadSnapshots.tutor.before, trace.writingPadSnapshots.tutor.after),
    },
  };
}

/**
 * Calculate what changed in writing pad
 */
function calculateMemoryDelta(before, after) {
  if (!before || !after) return { noData: true };

  // Simple delta calculation
  return {
    newLessons: (after.preconscious?.lessons?.length || 0) - (before.preconscious?.lessons?.length || 0),
    newBreakthroughs:
      (after.unconscious?.breakthroughs?.length || 0) - (before.unconscious?.breakthroughs?.length || 0),
    newTraumas:
      (after.unconscious?.unresolvedTraumas?.length || 0) - (before.unconscious?.unresolvedTraumas?.length || 0),
  };
}

// ============================================================================
// Standalone Learner Response (for evaluation pipeline)
// ============================================================================

/**
 * Call the LLM for a learner agent using tutor-core's public callAI().
 * This ensures learner and tutor calls go through identical logic for retries
 * (429s, context overflow, empty content) and provider-specific message formatting.
 *
 * @param {Object} agentConfig - From learnerConfig.getAgentConfig()
 * @param {string} systemPrompt - Static system/persona prompt (cacheable)
 * @param {string} userPrompt - Dynamic per-call user content
 * @param {string} agentRole - For logging (e.g. 'ego', 'superego')
 * @returns {Promise<Object>} Learner result shape
 */
async function callLearnerAI(agentConfig, systemPrompt, userPrompt, agentRole = 'learner', messageHistory = null) {
  // Delegate all retry and fetch logic to tutor-core
  const raw = await callAI(agentConfig, systemPrompt, userPrompt, agentRole, {
    messageHistory,
    // Add providerConfig for API key/base URL resolution if needed by tutor-core
    ...agentConfig.providerConfig,
  });

  // Map tutor-core result shape back to learner result shape
  return {
    content: raw.text,
    usage: {
      inputTokens: raw.inputTokens || 0,
      outputTokens: raw.outputTokens || 0,
    },
    finishReason: raw.finishReason || undefined,
    latencyMs: raw.latencyMs,
    model: raw.model || agentConfig.model,
    provider: raw.provider || agentConfig.provider,
    generationId: raw.generationId || null,
    ...(raw.contextOverflow && { contextOverflow: true, errorMessage: raw.errorMessage }),
    apiPayload: raw.apiPayload || {
      captureVersion: 1,
      source: 'learner_call',
      endpoint: agentConfig.providerConfig?.base_url,
      request: {
        method: 'POST',
        body: truncatePayload({
          model: raw.model || agentConfig.model,
          messages: messageHistory || [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      },
      response: {
        status: 101,
        body: truncatePayload({ text: raw.text }),
      },
    },
  };
}

// Remove the now-unused _callLearnerAIOnce

/**
 * Generate a single learner response for use by the evaluation pipeline.
 * Runs ego→superego→ego adjudication if profile is multi-agent, or single call if unified.
 *
 * Uses callLearnerAI internally — the same raw fetch layer as the tutor's
 * tutorDialogueEngine.callAI — so learner and tutor LLM calls go through
 * identical provider code paths with identical retry logic.
 *
 * @param {Object} options
 * @param {string} options.tutorMessage - The tutor's message to respond to
 * @param {string} options.topic - Current topic
 * @param {Array}  options.conversationHistory - [{role, content}, ...]
 * @param {string} options.learnerProfile - Profile name ('ego_superego' or 'unified')
 * @param {string} options.personaId - Persona identifier (default: 'eager_novice')
 * @param {string|Object} [options.modelOverride] - Optional model override (e.g. 'openrouter.nemotron') applied to all learner agents
 * @param {string} [options.egoModelOverride] - Optional override for learner ego model only (e.g. 'openrouter.haiku')
 * @param {string} [options.superegoModelOverride] - Optional override for learner superego model only (e.g. 'openrouter.kimi-k2.5')
 * @param {Function} [options.llmCall] - Injected LLM function (interactive path); uses callLearnerAI when null
 * @param {string} [options.memoryContext] - Pre-built narrative from learnerWritingPad
 * @param {Object} [options.trace] - Mutable trace object for interactive path token tracking
 * @returns {Promise<Object>} { message, externalMessage, internalDeliberation, emotionalState, understandingLevel, suggestsEnding, tokenUsage }
 */
export async function generateLearnerResponse(options) {
  const {
    tutorMessage,
    topic,
    conversationHistory = [],
    learnerProfile = 'unified',
    personaId = 'eager_novice',
    modelOverride,
    egoModelOverride,
    superegoModelOverride,
    profileContext,
    llmCall = null,
    memoryContext = null,
    trace = null,
    secret = null,
    conversationMode = 'single-prompt', // 'messages' for multi-turn message chains
  } = options;

  // Resolve model overrides. Priority: specific (ego/superego) > general (modelOverride) > YAML default
  function resolveOverride(ref) {
    if (!ref) return null;
    const r = learnerConfig.resolveModel(ref);
    const providerConfig = learnerConfig.getProviderConfig(r.provider);
    const modelFullId = providerConfig.models?.[r.model] || r.model;
    return { provider: r.provider, providerConfig, model: modelFullId, modelAlias: r.model };
  }

  const resolvedGeneralOverride = resolveOverride(modelOverride);
  const resolvedEgoOverride = resolveOverride(egoModelOverride);
  const resolvedSuperegoOverride = resolveOverride(superegoModelOverride);

  const applyOverride = (cfg, role) => {
    // Specific override for this role takes priority over general override
    const override =
      (role === 'ego' ? resolvedEgoOverride : role === 'superego' ? resolvedSuperegoOverride : null) ||
      resolvedGeneralOverride;
    if (!override || !cfg) return cfg;
    return {
      ...cfg,
      provider: override.provider,
      providerConfig: override.providerConfig,
      model: override.model,
      modelAlias: override.modelAlias,
    };
  };

  // Build learner's external message chain (roles inverted: tutor = user, learner = assistant)
  // Only used when conversationMode is 'messages'
  const useMessageChains = conversationMode === 'messages';
  let learnerExternalHistory = null;
  if (useMessageChains && conversationHistory.length > 0) {
    learnerExternalHistory = conversationHistory.map((m) => ({
      role: m.role === 'tutor' ? 'user' : 'assistant',
      content: extractExternalSection(m.content),
    }));
  }

  // Internal chains for ego-superego deliberation (within this turn)
  const learnerEgoInternalHistory = [];

  // Build LLM call adapter so both interactive (injected llmCall) and
  // eval (callLearnerAI) paths use the same pipeline.
  // The 5th argument is messageHistory for message chain mode.
  const callLLM = llmCall
    ? async (agentConfig, systemPrompt, userPrompt, _role, _msgHistory = null) => {
        const response = await llmCall(agentConfig.model, systemPrompt, [{ role: 'user', content: userPrompt }], {
          temperature: getRequiredTemperature(agentConfig, _role || 'learner_agent'),
          maxTokens: getRequiredMaxTokens(agentConfig, _role || 'learner_agent'),
          agentRole: _role,
        });
        return {
          content: response.content,
          usage: response.usage,
          model: response.model || agentConfig.model,
          provider: response.provider || agentConfig.provider || null,
          latencyMs: response.latencyMs || null,
          generationId: response.generationId || null,
          apiPayload: response.apiPayload || null,
        };
      }
    : callLearnerAI;

  const persona = learnerConfig.getPersona(personaId);
  const profile = learnerConfig.getActiveProfile(learnerProfile);
  const agentRoles = learnerConfig.getProfileAgentRoles(profile.name);
  const internalDeliberation = [];
  const tokenUsage = { inputTokens: 0, outputTokens: 0, apiCalls: 0 };

  // Build conversation context string from history
  const conversationContext = conversationHistory
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${extractExternalSection(m.content)}`)
    .join('\n\n');
  const visibleTutorMessage = extractExternalSection(tutorMessage);

  // Psychodynamic flow: Ego proposes → Superego comments → the same Ego adjudicates.
  // The superego is advisory only; it never drafts public learner speech.

  const hasMultiAgent = agentRoles.includes('ego') && agentRoles.includes('superego');

  if (hasMultiAgent) {
    // === STEP 1: Ego initial reaction ===
    const egoConfig = applyOverride(learnerConfig.getAgentConfig('ego', profile.name), 'ego');
    let egoContext = `Topic: ${topic}`;
    if (memoryContext) {
      egoContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    egoContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${visibleTutorMessage}"`;
    if (profileContext) {
      egoContext += `\n\n${profileContext}`;
    }
    egoContext += `\n\nGenerate your initial internal reaction as the learner's ego. Keep hidden reasoning private and put only the learner's actual wording in your final answer. If any nonspoken action aside is needed, put it in square brackets.`;
    const egoSystemPrompt = buildLearnerPrompt(egoConfig, persona, egoContext, secret, { guardContext: false });

    const egoInitialResponse = await callLLM(
      egoConfig,
      egoSystemPrompt,
      "React to the tutor's message.",
      'learner_ego',
      useMessageChains ? learnerExternalHistory : null,
    );
    const egoInitialEntry = makeDeliberationEntry('ego', egoInitialResponse, egoConfig, { stage: 'initial' });
    egoInitialEntry.inputMessages =
      useMessageChains && learnerExternalHistory
        ? [...learnerExternalHistory, { role: 'user', content: "React to the tutor's message." }]
        : null;
    internalDeliberation.push(egoInitialEntry);

    // Record ego initial output in internal chain (for ego revision)
    if (useMessageChains) {
      learnerEgoInternalHistory.push({
        role: 'assistant',
        content: sanitizeLearnerReusableText(egoInitialResponse.content),
      });
    }
    tokenUsage.inputTokens += egoInitialResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += egoInitialResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += egoInitialResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += egoInitialResponse.usage?.outputTokens || 0;
    }

    // === STEP 2: Superego critique ===
    const superegoConfig = applyOverride(learnerConfig.getAgentConfig('superego', profile.name), 'superego');
    let superegoContext = `Topic: ${topic}`;
    if (memoryContext) {
      superegoContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    superegoContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${visibleTutorMessage}"\n\nThe learner's initial reaction was:\n"${sanitizeLearnerReusableText(egoInitialResponse.content)}"`;
    if (profileContext) {
      superegoContext += `\n\n${profileContext}`;
    }
    superegoContext += `\n\nReview the learner's response. Is it accurate? What's being missed? What should be reconsidered?\n\nDo NOT draft the learner's replacement message. Comment on the initial response only.`;
    const superegoSystemPrompt = buildLearnerPrompt(superegoConfig, persona, superegoContext, secret, {
      guardContext: false,
    });

    const superegoResponse = await callLLM(
      superegoConfig,
      superegoSystemPrompt,
      "Critique the EGO's reaction.",
      'learner_superego',
    );
    const superegoEntry = makeDeliberationEntry('superego', superegoResponse, superegoConfig, { stage: 'critique' });
    superegoEntry.inputMessages = null; // superego uses single-prompt, not message chains
    internalDeliberation.push(superegoEntry);
    tokenUsage.inputTokens += superegoResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += superegoResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += superegoResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += superegoResponse.usage?.outputTokens || 0;
    }

    // === STEP 3: Ego adjudication (final authority) ===
    // The same ego considers the superego's feedback and decides what to actually say.
    // It may keep, reject, or modify the initial suggestion.
    let egoRevisionContext = `Topic: ${topic}`;
    if (memoryContext) {
      egoRevisionContext += `\n\nYour memory and state:\n${memoryContext}`;
    }
    egoRevisionContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${visibleTutorMessage}"\n\nYour initial reaction was:\n"${sanitizeLearnerReusableText(egoInitialResponse.content)}"\n\nInternal review feedback:\n"${sanitizeLearnerReusableText(superegoResponse.content)}"`;
    if (profileContext) {
      egoRevisionContext += `\n\n${profileContext}`;
    }
    egoRevisionContext += `\n\nYou are the same learner persona who made the initial suggestion. Adjudicate the feedback: keep your initial response if it is better, revise lightly if needed, or revise substantially if the review reveals a real problem.\n\nReturn exactly:\nPRIVATE_DECISION: [one short private sentence naming keep/revise and why]\nFINAL:\n[what the learner would say out loud to the tutor, 1-4 sentences]\n\nThe FINAL section must contain only public learner speech. Do NOT include internal thoughts, meta-commentary, references to any review process, or <think> blocks in FINAL. If any nonspoken action aside is needed, put it in square brackets.`;
    const egoRevisionSystemPrompt = buildLearnerPrompt(egoConfig, persona, egoRevisionContext, secret, {
      guardContext: false,
    });

    // Build combined history for ego revision: external + ego internal + superego feedback
    let egoRevisionMsgHistory = null;
    if (useMessageChains) {
      egoRevisionMsgHistory = [
        ...(learnerExternalHistory || []),
        ...learnerEgoInternalHistory,
        {
          role: 'user',
          content: `Internal review feedback:\n${sanitizeLearnerReusableText(superegoResponse.content)}`,
        },
      ];
    }

    const egoFinalResponse = await callLLM(
      egoConfig,
      egoRevisionSystemPrompt,
      'Produce your final response to the tutor.',
      'learner_ego',
      egoRevisionMsgHistory,
    );
    const egoRevisionEntry = makeDeliberationEntry('ego', egoFinalResponse, egoConfig, { stage: 'adjudication' });
    egoRevisionEntry.inputMessages = egoRevisionMsgHistory
      ? [...egoRevisionMsgHistory, { role: 'user', content: 'Produce your final response to the tutor.' }]
      : null;
    internalDeliberation.push(egoRevisionEntry);
    tokenUsage.inputTokens += egoFinalResponse.usage?.inputTokens || 0;
    tokenUsage.outputTokens += egoFinalResponse.usage?.outputTokens || 0;
    tokenUsage.apiCalls++;
    if (trace?.metrics) {
      trace.metrics.learnerInputTokens += egoFinalResponse.usage?.inputTokens || 0;
      trace.metrics.learnerOutputTokens += egoFinalResponse.usage?.outputTokens || 0;
    }

    // Log deliberation for debugging/analysis
    if (process.env.LEARNER_DEBUG) {
      console.log('\n┌─────────────────────────────────────────────────────────────');
      console.log('│ LEARNER DELIBERATION (ego→superego→ego adjudication)');
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ EGO INITIAL: ${egoInitialResponse.content.substring(0, 200)}...`);
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ SUPEREGO: ${superegoResponse.content.substring(0, 200)}...`);
      console.log('├─────────────────────────────────────────────────────────────');
      console.log(`│ EGO REVISION (FINAL): ${egoFinalResponse.content.substring(0, 200)}...`);
      console.log('└─────────────────────────────────────────────────────────────\n');
    }
  } else {
    // Single-agent (unified) flow — run each role sequentially as before
    for (const role of agentRoles) {
      const agentConfig = applyOverride(learnerConfig.getAgentConfig(role, profile.name), role);
      if (!agentConfig) continue;

      let roleContext = `Topic: ${topic}`;
      if (memoryContext) {
        roleContext += `\n\nYour memory and state:\n${memoryContext}`;
      }
      roleContext += `\n\nRecent conversation:\n${conversationContext}\n\nThe tutor just said:\n"${visibleTutorMessage}"`;
      if (profileContext) {
        roleContext += `\n\n${profileContext}`;
      }
      roleContext +=
        role === 'unified_learner'
          ? '\n\nRespond with ONLY what the learner would actually say out loud next to the tutor (1-4 sentences). Do NOT include internal monologue, tags, meta-commentary, or <think> blocks. If any nonspoken action aside is needed, put it in square brackets.'
          : "\n\nGenerate your internal reaction as this dimension of the learner's experience.";

      const systemPrompt = buildLearnerPrompt(agentConfig, persona, roleContext, secret, { guardContext: false });
      const response = await callLLM(agentConfig, systemPrompt, "React to the tutor's message.", `learner_${role}`);

      internalDeliberation.push(makeDeliberationEntry(role, response, agentConfig));
      tokenUsage.inputTokens += response.usage?.inputTokens || 0;
      tokenUsage.outputTokens += response.usage?.outputTokens || 0;
      tokenUsage.apiCalls++;
      if (trace?.metrics) {
        trace.metrics.learnerInputTokens += response.usage?.inputTokens || 0;
        trace.metrics.learnerOutputTokens += response.usage?.outputTokens || 0;
      }
    }
  }

  // Get final message from the last deliberation step
  // For multi-agent: ego adjudication. For unified: the single agent's output.
  const finalDeliberation = internalDeliberation[internalDeliberation.length - 1];
  const emotionalState = detectEmotionalState(internalDeliberation);

  // Keep the raw deliberation in the trace, but sanitize learner-visible text
  // before it reaches the tutor or gets reused in later turns.
  const rawContent = finalDeliberation.content;
  const externalOnly = extractExternalSection(rawContent);

  return {
    message: externalOnly,
    externalMessage: externalOnly,
    internalDeliberation,
    emotionalState,
    understandingLevel: detectUnderstandingLevel(internalDeliberation),
    suggestsEnding: emotionalState === 'satisfied' || emotionalState === 'disengaged',
    tokenUsage,
  };
}

// ============================================================================
// Exports
// ============================================================================

// Named exports for pure helper functions (used in unit tests)
export {
  detectEmotionalState,
  detectUnderstandingLevel,
  detectTutorStrategy,
  extractTutorMessage,
  extractExternalSection,
  sanitizeLearnerReusableText,
  buildAnchoredRevisitCue,
  buildLearnerReframeEvent,
  buildLearnerReversalEvent,
  selectLearnerReversalEvent,
  pendingLearnerReversalEventsFromTrace,
  buildTutorReframeEventContext,
  buildTutorReversalEventContext,
  buildTutorAdaptationContext,
  buildTutorAffectiveAdaptationContext,
  tutorMovesToPolicy,
  resolveTutorTurnPlan,
  gateReversalEventByTrigger,
  buildTurnPlanConstraintLines,
  buildLearnerActionalResponseContext,
  calculateMemoryDelta,
  callLearnerAI,
  INTERACTION_OUTCOMES,
  getRequiredTemperature,
  getRequiredMaxTokens,
  buildSecretContext,
  assertSecretAbsent,
  buildLearnerPrompt,
};

export default {
  runInteraction,
  generateLearnerResponse,
  INTERACTION_OUTCOMES,
};
