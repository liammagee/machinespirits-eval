#!/usr/bin/env node

const realMode = process.argv.includes('--real');

if (realMode && !process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is required for --real mode.');
  process.exit(1);
}

if (!realMode) {
  process.env.OPENROUTER_API_KEY ||= 'mock-openrouter-key';
}

const { runDialogue, setQuietMode } = await import('../tutor-core/services/tutorDialogueEngine.js');

setQuietMode(true);

function readPositiveIntEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const egoMaxTokens = readPositiveIntEnv('PROBE_EGO_MAX_TOKENS', 256);
const superegoMaxTokens = readPositiveIntEnv('PROBE_SUPEREGO_MAX_TOKENS', egoMaxTokens);
const internalHistoryMaxChars = readPositiveIntEnv('PROBE_INTERNAL_HISTORY_MAX_CHARS', 600);
const modelOverride = process.env.PROBE_MODEL || null;
const egoModelOverride = process.env.PROBE_EGO_MODEL || modelOverride;
const superegoModelOverride = process.env.PROBE_SUPEREGO_MODEL || modelOverride;

const context = {
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
};

const internalHistoryConfig = {
  enabled: true,
  surface: 'messages',
  scope: 'unified_exchange',
  window: 1,
  max_chars_per_message: internalHistoryMaxChars,
};

const egoDraft = JSON.stringify([
  {
    action: 'review',
    actionTarget: 'lecture:dialectics-basics',
    contentId: 'lecture:dialectics-basics',
    message: 'Revisit the dialectical recognition primer and name where recognition differs from compliance.',
    reasoning: 'The learner is stuck on the recognition/compliance distinction and needs one focused review step.',
  },
]);

const superegoRejection = JSON.stringify({
  approved: false,
  interventionType: 'revise',
  feedback: 'The draft names the target but does not ask the learner to perform a concrete comparison.',
  confidence: 0.86,
  suggestedChanges: {
    revisions: ['Ask the learner to compare one recognition case with one compliance case before rereading.'],
  },
});

const egoRevision = JSON.stringify([
  {
    action: 'practice',
    actionTarget: 'activity:recognition-pairs',
    contentId: 'activity:recognition-pairs',
    message: 'Try recognition-pairs and write one sentence on how recognition differs from mere compliance.',
    reasoning: 'A bounded comparison task should surface the distinction the learner keeps missing.',
  },
]);

const responses = [egoDraft, superegoRejection, egoRevision];

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

async function runProbe(label, internalHistory) {
  const calls = [];
  let callIndex = 0;
  const originalFetch = global.fetch;

  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body || '{}');
    callIndex += 1;
    calls.push(summarizeBody(body, callIndex));
    if (realMode) {
      return originalFetch(_url, options);
    }

    const content = responses[Math.min(callIndex - 1, responses.length - 1)];
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: `mock-${label}-${callIndex}`,
          model: body.model,
          choices: [
            {
              finish_reason: 'stop',
              message: { content },
            },
          ],
          usage: {
            prompt_tokens: calls[calls.length - 1].approxPromptTokens,
            completion_tokens: estimateTokens(content),
            cost: 0,
          },
        };
      },
    };
  };

  try {
    const result = await runDialogue(context, {
      profileName: 'fast',
      maxRounds: 1,
      trace: false,
      _skipLogging: true,
      egoModel: egoModelOverride,
      superegoModel: superegoModelOverride,
      hyperparameters: { max_tokens: egoMaxTokens },
      superegoHyperparameters: { max_tokens: superegoMaxTokens },
      internalHistory,
    });

    return {
      label,
      mode: realMode ? 'real' : 'mock',
      success: result.suggestions?.length > 0,
      rounds: result.rounds,
      metrics: result.metrics,
      calls,
      totals: {
        promptChars: calls.reduce((sum, call) => sum + call.promptChars, 0),
        approxPromptTokens: calls.reduce((sum, call) => sum + call.approxPromptTokens, 0),
        internalChars: calls.reduce((sum, call) => sum + call.internalChars, 0),
      },
    };
  } finally {
    global.fetch = originalFetch;
  }
}

const baseline = await runProbe('baseline', null);
const treatment = await runProbe('internal-history', internalHistoryConfig);

const delta = {
  promptChars: treatment.totals.promptChars - baseline.totals.promptChars,
  approxPromptTokens: treatment.totals.approxPromptTokens - baseline.totals.approxPromptTokens,
  internalChars: treatment.totals.internalChars - baseline.totals.internalChars,
};

console.log(
  JSON.stringify(
    {
      profile: 'fast',
      mode: realMode ? 'real' : 'mock',
      maxRounds: 1,
      egoMaxTokensOverride: egoMaxTokens,
      superegoMaxTokensOverride: superegoMaxTokens,
      modelOverride,
      egoModelOverride,
      superegoModelOverride,
      internalHistoryConfig,
      baseline,
      treatment,
      delta,
      note: realMode
        ? 'Real provider probe: small capped comparison; still too small to establish quality effects.'
        : 'Mocked provider probe: exercises message assembly and token budget shape only; it does not measure learning quality.',
    },
    null,
    2,
  ),
);
