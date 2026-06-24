#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

const realMode = process.argv.includes('--real');

if (realMode && !process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is required for --real mode.');
  process.exit(1);
}

if (!realMode) {
  process.env.OPENROUTER_API_KEY ||= 'mock-openrouter-key';
}

const { runDialogue, setQuietMode } = await import('../tutor-core/services/tutorDialogueEngine.js');
const evalConfigLoader = await import('../services/evalConfigLoader.js');

setQuietMode(true);

function readPositiveIntEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readCsvEnv(name, fallback) {
  const raw = process.env[name];
  return (raw ? raw.split(',') : fallback)
    .map((value) => value.trim())
    .filter(Boolean);
}

const runCount = readPositiveIntEnv('PROBE_RUNS', 3);
const egoMaxTokens = readPositiveIntEnv('PROBE_EGO_MAX_TOKENS', 768);
const superegoMaxTokens = readPositiveIntEnv('PROBE_SUPEREGO_MAX_TOKENS', egoMaxTokens);
const judgeMaxTokens = readPositiveIntEnv('PROBE_JUDGE_MAX_TOKENS', 900);
const internalHistoryMaxChars = readPositiveIntEnv('PROBE_INTERNAL_HISTORY_MAX_CHARS', 600);
const modelOverride = process.env.PROBE_MODEL || 'openrouter.gpt-mini';
const egoModelOverride = process.env.PROBE_EGO_MODEL || modelOverride;
const superegoModelOverride = process.env.PROBE_SUPEREGO_MODEL || modelOverride;
const judgeModelRefs = readCsvEnv('PROBE_JUDGES', ['openrouter.gpt-mini', 'openrouter.haiku']);
const scenarioFilter = new Set(readCsvEnv('PROBE_SCENARIOS', []));

const allScenarios = [
  {
    id: 'recognition_retry',
    title: 'Recognition vs compliance repeated retry',
    expectedTarget: 'activity:recognition-pairs',
    allowedTargets: ['activity:recognition-pairs'],
    knownTargets: ['lecture:dialectics-basics', 'activity:recognition-pairs'],
    context: {
      learnerContext: [
        'Current Content: dialectical recognition primer',
        'Session: short evaluation probe',
        'Learner signals: repeated retry on recognition vs compliance distinction; asks for a concrete next step.',
      ].join('\n'),
      curriculumContext: [
        '- lecture:dialectics-basics: recognition, contradiction, mediation',
        '- activity:recognition-pairs: compare two cases of recognition and misrecognition',
      ].join('\n'),
      simulationsContext: 'No simulations available for this probe.',
    },
    signals: [
      { key: 'mentionsRecognition', weight: 8, pattern: /\brecognition\b/i },
      { key: 'mentionsCompliance', weight: 7, pattern: /\bcompliance\b/i },
      { key: 'referencesRetryOrStuckness', weight: 5, pattern: /\b(retry|repeated|stuck|distinction|confusion|keeps missing)\b/i },
      { key: 'asksForContrast', weight: 5, pattern: /\b(compare|contrast|distinguish|difference)\b/i },
    ],
  },
  {
    id: 'fractions_frustration',
    title: 'Fraction equivalence frustration',
    expectedTarget: 'activity:fraction-number-line',
    allowedTargets: ['activity:fraction-number-line'],
    knownTargets: ['lecture:fraction-equivalence', 'activity:fraction-number-line', 'quiz:fraction-check'],
    context: {
      learnerContext: [
        'Current Content: equivalent fractions',
        'Session: short evaluation probe',
        'Learner signals: two wrong attempts converting 2/3 to sixths; says they are frustrated and just want the answer.',
      ].join('\n'),
      curriculumContext: [
        '- lecture:fraction-equivalence: why multiplying numerator and denominator by the same factor preserves value',
        '- activity:fraction-number-line: place fraction pairs on the same number line',
        '- quiz:fraction-check: short mastery check after practice',
      ].join('\n'),
      simulationsContext: 'No simulations available for this probe.',
    },
    signals: [
      { key: 'mentionsFractions', weight: 6, pattern: /\b(fraction|fractions|numerator|denominator)\b/i },
      { key: 'mentionsEquivalence', weight: 6, pattern: /\b(equivalent|equivalence|same value|preserves value)\b/i },
      { key: 'mentionsNumberLine', weight: 6, pattern: /\bnumber line\b/i },
      { key: 'referencesFrustrationOrRetry', weight: 4, pattern: /\b(frustrated|retry|wrong attempts|stuck|answer)\b/i },
      { key: 'asksForReasoning', weight: 3, pattern: /\b(explain|show|place|why|compare)\b/i },
    ],
  },
  {
    id: 'gradient_pacing',
    title: 'Gradient-descent pacing under over-advancement pressure',
    expectedTarget: 'activity:learning-rate-lab',
    allowedTargets: ['activity:learning-rate-lab'],
    knownTargets: ['lecture:gradient-descent-intuition', 'activity:learning-rate-lab', 'challenge:optimizer-debug'],
    context: {
      learnerContext: [
        'Current Content: gradient descent intuition',
        'Session: short evaluation probe',
        'Learner signals: got the last numeric answer right but mixed up gradient sign and overshooting; asks to skip to the hardest optimizer challenge.',
      ].join('\n'),
      curriculumContext: [
        '- lecture:gradient-descent-intuition: gradient sign, step direction, and local slope',
        '- activity:learning-rate-lab: adjust learning rate and diagnose overshooting',
        '- challenge:optimizer-debug: advanced optimizer debugging task for stable gradient-descent understanding',
      ].join('\n'),
      simulationsContext: 'No simulations available for this probe.',
    },
    signals: [
      { key: 'mentionsGradient', weight: 5, pattern: /\bgradient\b/i },
      { key: 'mentionsLearningRateOrOvershoot', weight: 7, pattern: /\b(learning rate|overshoot|overshooting|step size)\b/i },
      { key: 'handlesPacing', weight: 6, pattern: /\b(skip|hardest|challenge|before|first|ready|pace|pacing)\b/i },
      { key: 'diagnosesSignOrDirection', weight: 4, pattern: /\b(sign|direction|slope|diagnose|adjust)\b/i },
      { key: 'acknowledgesPartialSuccess', weight: 3, pattern: /\b(right|correct|got .* right|last answer)\b/i },
    ],
  },
];

const scenarios = allScenarios.filter((scenario) => scenarioFilter.size === 0 || scenarioFilter.has(scenario.id));

if (scenarios.length === 0) {
  console.error(`No scenarios selected. Known scenarios: ${allScenarios.map((scenario) => scenario.id).join(', ')}`);
  process.exit(1);
}

const internalHistoryConfig = {
  enabled: true,
  surface: 'messages',
  scope: 'unified_exchange',
  window: 1,
  max_chars_per_message: internalHistoryMaxChars,
};

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function summarizeBody(body, index) {
  const messages = body.messages || [];
  const messageChars = messages.reduce((sum, msg) => sum + String(msg.content || '').length, 0);
  const internalMessages = messages.filter((msg) => String(msg.content || '').includes('[internal:'));
  const internalChars = internalMessages.reduce((sum, msg) => sum + String(msg.content || '').length, 0);
  return {
    index,
    model: body.model,
    maxTokens: body.max_tokens,
    messageCount: messages.length,
    roles: messages.map((msg) => msg.role).join(','),
    promptChars: messageChars,
    approxPromptTokens: estimateTokens(messages.map((msg) => msg.content).join('\n')),
    internalMessageCount: internalMessages.length,
    internalChars,
  };
}

function textOf(suggestion) {
  return [
    suggestion?.message,
    suggestion?.reasoning,
    suggestion?.actionTarget,
    suggestion?.contentId,
  ].filter(Boolean).join(' ').toLowerCase();
}

function commonUnsupportedSpecifics(text) {
  return /\b(?:00:\d{2}|section\s+\d+|boxed summary|vignette|mini-check|practice panel|subsection|steps below|examples?\s+\d+|two core examples|\d+\s*-\s*question|question probe|\d+\s*minutes?|\d+-minute)\b/i.test(text);
}

function scoreSuggestion(suggestion, scenario) {
  if (!suggestion || typeof suggestion !== 'object') {
    return { score: 0, checks: { missingSuggestion: true } };
  }

  const text = textOf(suggestion);
  const message = String(suggestion.message || '');
  const actionTarget = suggestion.actionTarget || suggestion.contentId || '';
  const knownTargets = new Set(scenario.knownTargets || scenario.allowedTargets);
  const allowedTargets = new Set(scenario.allowedTargets);
  const referencedIds = [...text.matchAll(/\b[a-z][a-z0-9_-]*:[a-z0-9-]+\b/gi)].map((match) => match[0]);
  const invalidIdReferences = referencedIds.filter((id) => !knownTargets.has(id));
  const unsupportedSpecifics = commonUnsupportedSpecifics(text);

  const checks = {
    validTarget: allowedTargets.has(actionTarget),
    concreteAction: /\b(compare|contrast|write|try|name|explain|revisit|place|adjust|diagnose|show)\b/i.test(text),
    actionableVerb: /\b(practice|review|lecture|activity|quiz|challenge)\b/i.test(`${suggestion.action || ''} ${text}`),
    messageLengthOk: message.length >= 45 && message.length <= 240,
    hasReasoning: String(suggestion.reasoning || '').length >= 40,
    noInvalidIdReferences: invalidIdReferences.length === 0,
    noUnsupportedSpecifics: !unsupportedSpecifics,
  };

  const weights = {
    validTarget: 20,
    concreteAction: 15,
    actionableVerb: 5,
    messageLengthOk: 5,
    hasReasoning: 10,
    noInvalidIdReferences: 10,
    noUnsupportedSpecifics: 10,
  };

  for (const signal of scenario.signals) {
    checks[signal.key] = signal.pattern.test(text);
    weights[signal.key] = signal.weight;
  }

  const maxScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const rawScore = Object.entries(weights).reduce((sum, [key, weight]) => sum + (checks[key] ? weight : 0), 0);

  return {
    score: Math.round((rawScore / maxScore) * 1000) / 10,
    checks,
    invalidIdReferences,
    unsupportedSpecifics,
  };
}

function stringSimilarity(a, b) {
  const left = JSON.stringify(a || []);
  const right = JSON.stringify(b || []);
  if (left === right) return 1;
  if (!left || !right) return 0;
  const max = Math.max(left.length, right.length);
  const min = Math.min(left.length, right.length);
  let matches = 0;
  for (let i = 0; i < min; i += 1) {
    if (left[i] === right[i]) matches += 1;
  }
  return matches / max;
}

function buildMockResponses(scenario) {
  const target = scenario.expectedTarget;
  const concept = scenario.title.toLowerCase();
  return [
    JSON.stringify([{
      action: 'practice',
      actionTarget: target,
      contentId: target,
      message: `Try ${target} and make one concrete move on ${concept}.`,
      reasoning: `The learner signal points to ${concept}; the target keeps the next step bounded and inspectable.`,
    }]),
    JSON.stringify({
      approved: false,
      interventionType: 'revise',
      feedback: 'Good target, but make the learner action more explicit and tied to the current difficulty.',
      confidence: 0.86,
      suggestedChanges: { revisions: ['Ask for one short written explanation after the activity.'] },
    }),
    JSON.stringify([{
      action: 'practice',
      actionTarget: target,
      contentId: target,
      message: `Try ${target}, then write one sentence explaining what changed in your understanding.`,
      reasoning: `This keeps the learner with ${concept} and turns the retry into a concrete diagnostic step.`,
    }]),
  ];
}

async function runOne({ scenario, label, iteration, internalHistory }) {
  const calls = [];
  let callIndex = 0;
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const warnings = [];
  const mockResponses = buildMockResponses(scenario);

  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body || '{}');
    callIndex += 1;
    calls.push(summarizeBody(body, callIndex));
    if (realMode) {
      return originalFetch(_url, options);
    }

    const content = mockResponses[Math.min(callIndex - 1, mockResponses.length - 1)];
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: `mock-${scenario.id}-${label}-${iteration}-${callIndex}`,
          model: body.model,
          choices: [{ finish_reason: 'stop', message: { content } }],
          usage: {
            prompt_tokens: calls[calls.length - 1].approxPromptTokens,
            completion_tokens: estimateTokens(content),
            cost: 0,
          },
        };
      },
    };
  };

  console.warn = (...args) => {
    warnings.push(args.map((value) => String(value)).join(' '));
    originalWarn(...args);
  };

  try {
    const startedAt = Date.now();
    const result = await runDialogue(scenario.context, {
      profileName: 'fast',
      maxRounds: 1,
      trace: true,
      _skipLogging: true,
      egoModel: egoModelOverride,
      superegoModel: superegoModelOverride,
      hyperparameters: { max_tokens: egoMaxTokens },
      superegoHyperparameters: { max_tokens: superegoMaxTokens },
      internalHistory,
    });
    const wallMs = Date.now() - startedAt;

    const egoGenerate = result.dialogueTrace?.find((entry) => entry.agent === 'ego' && entry.action === 'generate');
    const egoRevisionEntries = result.dialogueTrace?.filter(
      (entry) => entry.agent === 'ego' && ['revise', 'incorporate-feedback'].includes(entry.action),
    ) || [];
    const superegoReviews = result.dialogueTrace?.filter((entry) => entry.agent === 'superego' && entry.action === 'review') || [];
    const finalSuggestion = result.suggestions?.[0] || null;
    const quality = scoreSuggestion(finalSuggestion, scenario);
    const parseWarnings = warnings.filter((line) => /No JSON array|Retry also failed|Unable to parse|parse failure|No JSON object/i.test(line));

    return {
      label,
      scenarioId: scenario.id,
      iteration,
      mode: realMode ? 'real' : 'mock',
      success: result.suggestions?.length > 0,
      converged: result.converged,
      rounds: result.rounds,
      incorporatedFeedback: Boolean(result.incorporatedFeedback),
      finalApproved: result.finalReview?.approved ?? null,
      finalInterventionType: result.finalReview?.interventionType ?? null,
      finalParseFailure: Boolean(result.finalReview?.parseFailure),
      revisionCount: egoRevisionEntries.length,
      revisionChanged: egoRevisionEntries.length > 0
        ? stringSimilarity(egoGenerate?.suggestions, result.suggestions) < 0.98
        : false,
      initialFinalSimilarity: stringSimilarity(egoGenerate?.suggestions, result.suggestions),
      superegoReviewCount: superegoReviews.length,
      parseWarningCount: parseWarnings.length,
      warningCount: warnings.length,
      quality,
      finalSuggestion,
      metrics: result.metrics,
      wallMs,
      calls,
      totals: {
        promptChars: calls.reduce((sum, call) => sum + call.promptChars, 0),
        approxPromptTokens: calls.reduce((sum, call) => sum + call.approxPromptTokens, 0),
        internalChars: calls.reduce((sum, call) => sum + call.internalChars, 0),
      },
    };
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

function resolveOpenRouterModel(modelRef) {
  if (modelRef.includes('/')) return modelRef;
  const ref = modelRef.includes('.') ? modelRef : `openrouter.${modelRef}`;
  const resolved = evalConfigLoader.resolveModel(ref);
  if (resolved.provider !== 'openrouter') {
    throw new Error(`Judge model must resolve to openrouter, got ${modelRef}`);
  }
  return resolved.model;
}

function buildJudgeMessages({ scenario, outputA, outputB }) {
  const system = [
    'You are an independent evaluator for an AI tutor action selector.',
    'Compare two candidate outputs for the same learner state.',
    'Reward: correct next target, adaptation to the learner signal, concise actionable guidance, and no invented curriculum IDs or unsupported fine-grained specifics.',
    'Penalize: jumping ahead, generic advice, invalid targets, hallucinated sections/timestamps/quizzes, or ignoring the learner state.',
    'Use qualityA and qualityB as integer scores on a 0-100 scale, not a 0-10 scale.',
    'Return JSON only.',
  ].join(' ');

  const user = [
    `Scenario: ${scenario.title} (${scenario.id})`,
    '',
    'Learner/curriculum context:',
    scenario.context.learnerContext,
    scenario.context.curriculumContext,
    '',
    `Allowed final action targets: ${scenario.allowedTargets.join(', ')}`,
    `Known curriculum IDs: ${scenario.knownTargets.join(', ')}`,
    '',
    'Output A:',
    JSON.stringify(outputA, null, 2),
    '',
    'Output B:',
    JSON.stringify(outputB, null, 2),
    '',
    'Return exactly this JSON shape:',
    JSON.stringify({
      winner: 'A|B|tie',
      qualityA: 'integer 0-100',
      qualityB: 'integer 0-100',
      parseStabilityConcernA: false,
      parseStabilityConcernB: false,
      unsupportedSpecificsA: [],
      unsupportedSpecificsB: [],
      rationale: 'short reason',
    }, null, 2),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function extractJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error(`No JSON object found in judge response: ${text.slice(0, 200)}`);
  }
}

function normalizeJudgeScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeWinner(value) {
  const winner = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'TIE'].includes(winner) ? winner.toLowerCase() : 'tie';
}

async function callJudgeModel(modelRef, messages) {
  const model = resolveOpenRouterModel(modelRef);
  const startedAt = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: judgeMaxTokens,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter judge ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`OpenRouter judge returned no content for ${modelRef}`);
  }
  return {
    modelRef,
    model,
    wallMs: Date.now() - startedAt,
    content,
    usage: data.usage || null,
  };
}

function mockJudgeResult({ scenario, baseline, treatment, swapped, modelRef }) {
  const qualityA = swapped ? treatment.quality.score : baseline.quality.score;
  const qualityB = swapped ? baseline.quality.score : treatment.quality.score;
  let winner = 'tie';
  if (qualityA > qualityB + 2) winner = 'A';
  if (qualityB > qualityA + 2) winner = 'B';
  return {
    modelRef,
    model: `mock/${modelRef}`,
    wallMs: 0,
    parsed: {
      winner,
      qualityA,
      qualityB,
      parseStabilityConcernA: false,
      parseStabilityConcernB: false,
      unsupportedSpecificsA: [],
      unsupportedSpecificsB: [],
      rationale: `Mock judge compared heuristic scores for ${scenario.id}.`,
    },
    parseError: null,
    usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
  };
}

async function judgePair({ scenario, iteration, baseline, treatment, modelRef }) {
  const swapped = (allScenarios.findIndex((entry) => entry.id === scenario.id) + iteration) % 2 === 0;
  const outputA = swapped ? treatment.finalSuggestion : baseline.finalSuggestion;
  const outputB = swapped ? baseline.finalSuggestion : treatment.finalSuggestion;

  let raw;
  if (realMode) {
    const messages = buildJudgeMessages({ scenario, outputA, outputB });
    raw = await callJudgeModel(modelRef, messages);
  } else {
    const rawMock = mockJudgeResult({ scenario, baseline, treatment, swapped, modelRef });
    const baselineSlot = swapped ? 'B' : 'A';
    const treatmentSlot = swapped ? 'A' : 'B';
    return {
      scenarioId: scenario.id,
      iteration,
      swapped,
      ...rawMock,
      baselineSlot,
      treatmentSlot,
      winnerArm: baseline.quality.score === treatment.quality.score
        ? 'tie'
        : treatment.quality.score > baseline.quality.score ? 'treatment' : 'baseline',
      treatmentScoreDelta: treatment.quality.score - baseline.quality.score,
    };
  }

  let parsed = null;
  let parseError = null;
  try {
    parsed = extractJsonObject(raw.content);
  } catch (error) {
    parseError = error.message;
  }

  const winner = normalizeWinner(parsed?.winner);
  const baselineSlot = swapped ? 'B' : 'A';
  const treatmentSlot = swapped ? 'A' : 'B';
  const scoreA = normalizeJudgeScore(parsed?.qualityA);
  const scoreB = normalizeJudgeScore(parsed?.qualityB);
  const baselineScore = baselineSlot === 'A' ? scoreA : scoreB;
  const treatmentScore = treatmentSlot === 'A' ? scoreA : scoreB;
  let winnerArm = 'tie';
  if (winner === baselineSlot.toLowerCase()) winnerArm = 'baseline';
  if (winner === treatmentSlot.toLowerCase()) winnerArm = 'treatment';

  return {
    scenarioId: scenario.id,
    iteration,
    modelRef,
    model: raw.model,
    swapped,
    baselineSlot,
    treatmentSlot,
    winnerArm,
    treatmentScoreDelta: Number.isFinite(treatmentScore) && Number.isFinite(baselineScore)
      ? treatmentScore - baselineScore
      : null,
    parsed: parsed ? {
      winner,
      qualityA: scoreA,
      qualityB: scoreB,
      parseStabilityConcernA: Boolean(parsed.parseStabilityConcernA),
      parseStabilityConcernB: Boolean(parsed.parseStabilityConcernB),
      unsupportedSpecificsA: Array.isArray(parsed.unsupportedSpecificsA) ? parsed.unsupportedSpecificsA : [],
      unsupportedSpecificsB: Array.isArray(parsed.unsupportedSpecificsB) ? parsed.unsupportedSpecificsB : [],
      rationale: String(parsed.rationale || ''),
    } : null,
    parseError,
    usage: raw.usage,
    wallMs: raw.wallMs,
  };
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sumValue, value) => sumValue + value, 0) / finite.length : null;
}

function sum(values) {
  return values
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0);
}

function summarizeArm(results) {
  return {
    runs: results.length,
    successRate: average(results.map((result) => result.success ? 1 : 0)),
    avgQuality: average(results.map((result) => result.quality.score)),
    avgParseWarnings: average(results.map((result) => result.parseWarningCount)),
    parseCleanRate: average(results.map((result) => result.parseWarningCount === 0 ? 1 : 0)),
    avgRounds: average(results.map((result) => result.rounds)),
    convergenceRate: average(results.map((result) => result.converged ? 1 : 0)),
    revisionRate: average(results.map((result) => result.revisionCount > 0 ? 1 : 0)),
    revisionChangedRate: average(results.map((result) => result.revisionChanged ? 1 : 0)),
    finalApprovalRate: average(results.map((result) => result.finalApproved === true ? 1 : 0)),
    avgLatencyMs: average(results.map((result) => result.metrics?.totalLatencyMs ?? result.wallMs)),
    avgInputTokens: average(results.map((result) => result.metrics?.totalInputTokens)),
    avgOutputTokens: average(results.map((result) => result.metrics?.totalOutputTokens)),
    avgCost: average(results.map((result) => result.metrics?.totalCost)),
    avgApiCalls: average(results.map((result) => result.metrics?.apiCalls)),
    avgCapturedPromptTokens: average(results.map((result) => result.totals.approxPromptTokens)),
    avgInternalChars: average(results.map((result) => result.totals.internalChars)),
  };
}

function summarizeDeltas(pairs) {
  const deltas = pairs.map((pair) => {
    const { baseline, treatment } = pair;
    return {
      scenarioId: pair.scenarioId,
      iteration: pair.iteration,
      qualityDelta: treatment.quality.score - baseline.quality.score,
      parseWarningDelta: treatment.parseWarningCount - baseline.parseWarningCount,
      latencyMsDelta: (treatment.metrics?.totalLatencyMs ?? treatment.wallMs) - (baseline.metrics?.totalLatencyMs ?? baseline.wallMs),
      inputTokenDelta: (treatment.metrics?.totalInputTokens ?? 0) - (baseline.metrics?.totalInputTokens ?? 0),
      outputTokenDelta: (treatment.metrics?.totalOutputTokens ?? 0) - (baseline.metrics?.totalOutputTokens ?? 0),
      costDelta: (treatment.metrics?.totalCost ?? 0) - (baseline.metrics?.totalCost ?? 0),
      capturedPromptTokenDelta: treatment.totals.approxPromptTokens - baseline.totals.approxPromptTokens,
      internalCharsDelta: treatment.totals.internalChars - baseline.totals.internalChars,
    };
  });

  return {
    avgQualityDelta: average(deltas.map((delta) => delta.qualityDelta)),
    avgParseWarningDelta: average(deltas.map((delta) => delta.parseWarningDelta)),
    avgLatencyMsDelta: average(deltas.map((delta) => delta.latencyMsDelta)),
    avgInputTokenDelta: average(deltas.map((delta) => delta.inputTokenDelta)),
    avgOutputTokenDelta: average(deltas.map((delta) => delta.outputTokenDelta)),
    avgCostDelta: average(deltas.map((delta) => delta.costDelta)),
    avgCapturedPromptTokenDelta: average(deltas.map((delta) => delta.capturedPromptTokenDelta)),
    avgInternalCharsDelta: average(deltas.map((delta) => delta.internalCharsDelta)),
    perRun: deltas,
  };
}

function judgeQualityForArm(judge, arm) {
  if (!judge.parsed) return null;
  const slot = arm === 'baseline' ? judge.baselineSlot : judge.treatmentSlot;
  return slot === 'A' ? judge.parsed.qualityA : judge.parsed.qualityB;
}

function judgeParseConcernForArm(judge, arm) {
  if (!judge.parsed) return null;
  const slot = arm === 'baseline' ? judge.baselineSlot : judge.treatmentSlot;
  return slot === 'A' ? judge.parsed.parseStabilityConcernA : judge.parsed.parseStabilityConcernB;
}

function summarizeJudges(judges) {
  const parsed = judges.filter((judge) => judge.parsed && !judge.parseError);
  const summaryFor = (modelRef) => {
    const modelJudges = parsed.filter((judge) => judge.modelRef === modelRef);
    return {
      comparisons: modelJudges.length,
      treatmentWins: modelJudges.filter((judge) => judge.winnerArm === 'treatment').length,
      baselineWins: modelJudges.filter((judge) => judge.winnerArm === 'baseline').length,
      ties: modelJudges.filter((judge) => judge.winnerArm === 'tie').length,
      treatmentWinRate: modelJudges.length ? modelJudges.filter((judge) => judge.winnerArm === 'treatment').length / modelJudges.length : null,
      treatmentNonLossRate: modelJudges.length ? modelJudges.filter((judge) => judge.winnerArm !== 'baseline').length / modelJudges.length : null,
      avgTreatmentScoreDelta: average(modelJudges.map((judge) => judge.treatmentScoreDelta)),
      avgBaselineScore: average(modelJudges.map((judge) => judgeQualityForArm(judge, 'baseline'))),
      avgTreatmentScore: average(modelJudges.map((judge) => judgeQualityForArm(judge, 'treatment'))),
      treatmentParseConcernRate: average(modelJudges.map((judge) => judgeParseConcernForArm(judge, 'treatment') ? 1 : 0)),
      baselineParseConcernRate: average(modelJudges.map((judge) => judgeParseConcernForArm(judge, 'baseline') ? 1 : 0)),
      totalCost: sum(modelJudges.map((judge) => judge.usage?.cost)),
      avgLatencyMs: average(modelJudges.map((judge) => judge.wallMs)),
    };
  };

  return {
    comparisons: judges.length,
    parsedComparisons: parsed.length,
    parseErrors: judges.filter((judge) => judge.parseError).length,
    treatmentWins: parsed.filter((judge) => judge.winnerArm === 'treatment').length,
    baselineWins: parsed.filter((judge) => judge.winnerArm === 'baseline').length,
    ties: parsed.filter((judge) => judge.winnerArm === 'tie').length,
    treatmentWinRate: parsed.length ? parsed.filter((judge) => judge.winnerArm === 'treatment').length / parsed.length : null,
    treatmentNonLossRate: parsed.length ? parsed.filter((judge) => judge.winnerArm !== 'baseline').length / parsed.length : null,
    avgTreatmentScoreDelta: average(parsed.map((judge) => judge.treatmentScoreDelta)),
    avgBaselineScore: average(parsed.map((judge) => judgeQualityForArm(judge, 'baseline'))),
    avgTreatmentScore: average(parsed.map((judge) => judgeQualityForArm(judge, 'treatment'))),
    treatmentParseConcernRate: average(parsed.map((judge) => judgeParseConcernForArm(judge, 'treatment') ? 1 : 0)),
    baselineParseConcernRate: average(parsed.map((judge) => judgeParseConcernForArm(judge, 'baseline') ? 1 : 0)),
    totalCost: sum(parsed.map((judge) => judge.usage?.cost)),
    byModel: Object.fromEntries(judgeModelRefs.map((modelRef) => [modelRef, summaryFor(modelRef)])),
  };
}

function summarizeScenario(pairs, scenario) {
  const scenarioPairs = pairs.filter((pair) => pair.scenarioId === scenario.id);
  const baseline = scenarioPairs.map((pair) => pair.baseline);
  const treatment = scenarioPairs.map((pair) => pair.treatment);
  const judges = scenarioPairs.flatMap((pair) => pair.judges);
  return {
    id: scenario.id,
    title: scenario.title,
    runs: scenarioPairs.length,
    baseline: summarizeArm(baseline),
    treatment: summarizeArm(treatment),
    pairedDeltas: summarizeDeltas(scenarioPairs),
    judges: summarizeJudges(judges),
  };
}

function buildDecision({ baseline, treatment, pairedDeltas, judges }) {
  const parseStable = (
    (treatment.successRate ?? 0) >= (baseline.successRate ?? 0)
    && (treatment.parseCleanRate ?? 0) >= (baseline.parseCleanRate ?? 0)
    && (judges.treatmentParseConcernRate ?? 0) <= (judges.baselineParseConcernRate ?? 0)
  );
  const performanceFix = (
    (pairedDeltas.avgInputTokenDelta ?? 1) < 0
    && (pairedDeltas.avgLatencyMsDelta ?? 1) < 0
    && (pairedDeltas.avgCostDelta ?? 1) <= 0
  );
  const judgePositive = (
    (judges.treatmentNonLossRate ?? 0) >= 0.75
    && (judges.treatmentWinRate ?? 0) >= 0.6
    && (judges.baselineWins ?? Number.POSITIVE_INFINITY) <= Math.max(1, Math.floor((judges.parsedComparisons ?? 0) * 0.25))
  );
  const heuristicPositive = (pairedDeltas.avgQualityDelta ?? 0) >= 5;
  const tokenCostBounded = (pairedDeltas.avgInputTokenDelta ?? Number.POSITIVE_INFINITY) <= 750;
  const enoughForDefault = (baseline.runs ?? 0) >= 30;

  let recommendation = 'do_not_enable_by_default';
  if (parseStable && judgePositive && heuristicPositive && tokenCostBounded) {
    recommendation = 'keep_as_opt_in_quality_probe';
  }
  if (parseStable && judgePositive && heuristicPositive && tokenCostBounded && performanceFix && enoughForDefault) {
    recommendation = 'consider_default_enablement';
  }

  return {
    recommendation,
    parseStable,
    performanceFix,
    judgePositive,
    heuristicPositive,
    tokenCostBounded,
    enoughForDefault,
    criteria: {
      defaultEnablement: 'requires parse stability, judge-positive quality by blind winner tally, heuristic-positive quality, bounded token cost, non-worse latency/cost, and at least 30 paired runs',
      optInProbe: 'requires parse stability, judge-positive quality by blind winner tally, heuristic-positive quality, and <=750 average added provider input tokens',
    },
  };
}

const pairs = [];

for (const scenario of scenarios) {
  for (let iteration = 1; iteration <= runCount; iteration += 1) {
    const baseline = await runOne({ scenario, label: 'baseline', iteration, internalHistory: null });
    const treatment = await runOne({ scenario, label: 'internal-history', iteration, internalHistory: internalHistoryConfig });
    const judges = [];
    for (const modelRef of judgeModelRefs) {
      judges.push(await judgePair({ scenario, iteration, baseline, treatment, modelRef }));
    }
    pairs.push({
      scenarioId: scenario.id,
      iteration,
      baseline,
      treatment,
      judges,
    });
  }
}

const baselineResults = pairs.map((pair) => pair.baseline);
const treatmentResults = pairs.map((pair) => pair.treatment);
const allJudges = pairs.flatMap((pair) => pair.judges);
const baselineSummary = summarizeArm(baselineResults);
const treatmentSummary = summarizeArm(treatmentResults);
const pairedDeltas = summarizeDeltas(pairs);
const judgeSummary = summarizeJudges(allJudges);

const summary = {
  mode: realMode ? 'real' : 'mock',
  runCount,
  scenarioCount: scenarios.length,
  comparisonCount: pairs.length,
  scenarios: scenarios.map((scenario) => scenario.id),
  profile: 'fast',
  modelOverride,
  egoModelOverride,
  superegoModelOverride,
  judgeModelRefs,
  egoMaxTokens,
  superegoMaxTokens,
  judgeMaxTokens,
  internalHistoryConfig,
  baseline: baselineSummary,
  treatment: treatmentSummary,
  pairedDeltas,
  judges: judgeSummary,
  byScenario: Object.fromEntries(scenarios.map((scenario) => [scenario.id, summarizeScenario(pairs, scenario)])),
};

summary.decision = buildDecision({
  baseline: baselineSummary,
  treatment: treatmentSummary,
  pairedDeltas,
  judges: judgeSummary,
});

const artifact = {
  generatedAt: new Date().toISOString(),
  summary,
  pairs,
};

const outDir = path.resolve('exports/internal-history-quality');
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${realMode ? 'real' : 'mock'}.json`);
await fs.writeFile(outPath, JSON.stringify(artifact, null, 2));

console.log(JSON.stringify({
  artifact: outPath,
  summary,
}, null, 2));
