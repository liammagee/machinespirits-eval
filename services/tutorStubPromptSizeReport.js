export const TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA =
  'machinespirits.tutor-stub.prompt-size-report.v1';

export const TUTOR_STUB_PROMPT_SIZE_TOKENIZER = Object.freeze({
  id: 'utf16-code-units-div-4-ceiling-v1',
  kind: 'heuristic',
  version: '1',
  unit: 'utf16_code_units',
  unitsPerToken: 4,
});

export const TUTOR_STUB_PROMPT_SIZE_SECTIONS = Object.freeze([
  Object.freeze({ id: 'base_tutor_rules', key: 'baseTutorRules', label: 'Base tutor rules' }),
  Object.freeze({ id: 'world_scene', key: 'worldScene', label: 'World / scene' }),
  Object.freeze({ id: 'evidence_safety', key: 'evidenceSafety', label: 'Evidence / safety' }),
  Object.freeze({ id: 'named_tutor', key: 'namedTutor', label: 'Named tutor' }),
  Object.freeze({ id: 'public_history', key: 'publicHistory', label: 'Public history' }),
  Object.freeze({
    id: 'public_evidence_window',
    key: 'publicEvidenceWindow',
    label: 'Public evidence window',
  }),
  Object.freeze({ id: 'classifier', key: 'classifier', label: 'Classifier' }),
  Object.freeze({ id: 'learner_dag', key: 'learnerDag', label: 'Learner-DAG' }),
  Object.freeze({ id: 'scaffold', key: 'scaffold', label: 'Scaffold' }),
  Object.freeze({ id: 'host_plan', key: 'hostPlan', label: 'Host plan' }),
  Object.freeze({ id: 'transport_tail', key: 'transportTail', label: 'Transport tail' }),
]);

const SYSTEM_WORLD_MARKER = '# Detective-story world';
const SYSTEM_EVIDENCE_MARKER = '# Speaking-tutor evidence contract';
const SYSTEM_NAMED_TUTOR_MARKER = '[Named tutor instance:';
const STRUCTURED_NO_TOOLS_TAIL =
  'This is a no-tools structured-output call. Do not run commands, inspect files, browse, call tools, or take any action beyond returning the requested JSON object.';
const LATEST_BLOCKS = Object.freeze([
  Object.freeze({
    key: 'publicEvidenceWindow',
    start: '[Tutor-only public evidence window]',
    end: '[End tutor-only public evidence window]',
  }),
  Object.freeze({
    key: 'classifier',
    start: '[Tutor-only learner classifier]',
    end: '[End tutor-only learner classifier]',
  }),
  Object.freeze({
    key: 'learnerDag',
    start: '[Tutor-only redacted learner-DAG model]',
    end: '[End tutor-only redacted learner-DAG model]',
  }),
  Object.freeze({
    key: 'scaffold',
    start: '[Tutor-only human discourse scaffold]',
    end: '[End tutor-only human discourse scaffold]',
  }),
  Object.freeze({
    key: 'hostPlan',
    start: '[Tutor-only joint-performance host plan]',
    end: '[End tutor-only joint-performance host plan]',
  }),
  Object.freeze({
    key: 'hostPlan',
    start: '[Tutor-only host plan]',
    end: '[End tutor-only host plan]',
  }),
  Object.freeze({
    key: 'hostPlan',
    start: '[Tutor-only first-draft performance contract]',
    end: '[End tutor-only first-draft performance contract]',
  }),
]);

const OBSERVED_INPUT_PATHS = Object.freeze([
  Object.freeze(['inputTokens']),
  Object.freeze(['input_tokens']),
  Object.freeze(['promptTokens']),
  Object.freeze(['prompt_tokens']),
  Object.freeze(['promptTokenCount']),
  Object.freeze(['usage', 'inputTokens']),
  Object.freeze(['usage', 'input_tokens']),
  Object.freeze(['usage', 'promptTokens']),
  Object.freeze(['usage', 'prompt_tokens']),
  Object.freeze(['usageMetadata', 'promptTokenCount']),
  Object.freeze(['metrics', 'usage', 'inputTokens']),
  Object.freeze(['metrics', 'usage', 'input_tokens']),
  Object.freeze(['metrics', 'usage', 'prompt_tokens']),
]);

function finiteNonNegativeTokenCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function valueAtPath(value, path) {
  let cursor = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function sectionText(sections, definition) {
  const camelValue = sections?.[definition.key];
  const snakeValue = sections?.[definition.id];
  const value = camelValue ?? snakeValue ?? '';
  if (typeof value !== 'string') {
    throw new TypeError(`Prompt-size section ${definition.id} must be a string when provided.`);
  }
  return value;
}

function serializableTokenizerDescriptor(tokenizer) {
  if (!tokenizer || typeof tokenizer !== 'object') {
    throw new TypeError('Prompt-size tokenizer must be described by an object.');
  }
  const descriptor = {};
  for (const [key, value] of Object.entries(tokenizer)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      descriptor[key] = value;
    }
  }
  if (!descriptor.id) throw new TypeError('Prompt-size tokenizer descriptor requires an id.');
  return descriptor;
}

function defaultEstimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / TUTOR_STUB_PROMPT_SIZE_TOKENIZER.unitsPerToken);
}

function measuredText(text, estimateTokens) {
  const estimatedTokens = finiteNonNegativeTokenCount(estimateTokens(text));
  if (estimatedTokens === null) {
    throw new TypeError('Prompt-size token estimator must return a finite non-negative number.');
  }
  return {
    chars: text.length,
    utf8Bytes: Buffer.byteLength(text, 'utf8'),
    estimatedTokens,
  };
}

function systemSections(systemPrompt = '') {
  const text = String(systemPrompt || '');
  const worldStart = text.indexOf(SYSTEM_WORLD_MARKER);
  const evidenceStart = text.indexOf(SYSTEM_EVIDENCE_MARKER);
  const namedTutorStart = text.indexOf(SYSTEM_NAMED_TUTOR_MARKER);
  if (
    worldStart < 0 ||
    evidenceStart < worldStart ||
    namedTutorStart < evidenceStart
  ) {
    return {
      baseTutorRules: text,
      worldScene: '',
      evidenceSafety: '',
      namedTutor: '',
    };
  }
  return {
    baseTutorRules: text.slice(0, worldStart),
    worldScene: text.slice(worldStart, evidenceStart),
    evidenceSafety: text.slice(evidenceStart, namedTutorStart),
    namedTutor: text.slice(namedTutorStart),
  };
}

function taggedLatestSections(latestContent = '') {
  const text = String(latestContent || '');
  const claimed = [];
  const values = {
    publicEvidenceWindow: '',
    classifier: '',
    learnerDag: '',
    scaffold: '',
    hostPlan: '',
  };
  for (const block of LATEST_BLOCKS) {
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf(block.start, cursor);
      if (start < 0) break;
      const endMarkerStart = text.indexOf(block.end, start + block.start.length);
      if (endMarkerStart < 0) break;
      const end = endMarkerStart + block.end.length;
      const overlaps = claimed.some((range) => start < range.end && end > range.start);
      if (!overlaps) {
        values[block.key] += text.slice(start, end);
        claimed.push({ start, end });
      }
      cursor = end;
    }
  }
  claimed.sort((left, right) => left.start - right.start);
  let remainder = '';
  let cursor = 0;
  for (const range of claimed) {
    remainder += text.slice(cursor, range.start);
    cursor = range.end;
  }
  remainder += text.slice(cursor);
  return { ...values, remainder };
}

/**
 * Partition the exact caller-authored Codex CLI stdin surface. The section
 * strings are disjoint: their combined character count equals the actual
 * bridge prompt, while provider/runtime additions remain outside the authored
 * estimate and therefore appear only in the inferred residual.
 */
export function tutorStubPromptSizeSectionsFromRequest({
  systemPrompt = '',
  messages = [],
  structuredOutput = false,
} = {}) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const latest = normalizedMessages.at(-1) || { role: 'user', content: '' };
  const history = normalizedMessages.slice(0, -1);
  const publicHistory = history
    .map((message) => `${message?.role || 'user'}: ${message?.content || ''}`)
    .join('\n\n');
  const latestSections = taggedLatestSections(latest?.content || '');
  const wrappers = [
    'System prompt for this role:\n',
    '\n\nUser input for this turn:\n',
    ...(history.length ? ['Conversation so far:\n', '\n\n'] : []),
    'Latest message:\n',
    structuredOutput ? `\n\n${STRUCTURED_NO_TOOLS_TAIL}` : '',
  ].join('');
  return {
    ...systemSections(systemPrompt),
    publicHistory,
    publicEvidenceWindow: latestSections.publicEvidenceWindow,
    classifier: latestSections.classifier,
    learnerDag: latestSections.learnerDag,
    scaffold: latestSections.scaffold,
    hostPlan: latestSections.hostPlan,
    transportTail: `${wrappers}${latestSections.remainder}`,
  };
}

export function summarizeTutorStubPromptSizeReports(reports = []) {
  const rows = (Array.isArray(reports) ? reports : []).filter(
    (report) => report?.schema === TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA,
  );
  const authored = rows.map((report) => report.authoredTotal?.estimatedTokens ?? null);
  const observed = rows.map((report) => report.observedProviderInput?.tokens ?? null);
  const residual = rows.map((report) => report.inferredResidual?.tokens ?? null);
  const complete = (values) =>
    rows.length > 0 && values.length === rows.length && values.every((value) => value !== null);
  const total = (values) => (complete(values) ? values.reduce((sum, value) => sum + value, 0) : null);
  const mean = (values) => (complete(values) && values.length ? total(values) / values.length : null);
  return {
    schema: TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA,
    calls: rows.length,
    tokenizer: rows.length ? rows[0].tokenizer : { ...TUTOR_STUB_PROMPT_SIZE_TOKENIZER },
    authoredEstimateComplete: complete(authored),
    totalAuthoredEstimatedTokens: total(authored),
    meanAuthoredEstimatedTokens: mean(authored),
    observedProviderInputComplete: complete(observed),
    totalObservedProviderInputTokens: total(observed),
    meanObservedProviderInputTokens: mean(observed),
    inferredResidualComplete: complete(residual),
    totalInferredResidualTokens: total(residual),
    meanInferredResidualTokens: mean(residual),
  };
}

/**
 * Extract provider-observed input usage without turning missing usage into zero.
 * The source path is retained so reports distinguish provider usage from an
 * authored estimate.
 */
export function tutorStubObservedProviderInput(usage = null) {
  for (const path of OBSERVED_INPUT_PATHS) {
    const tokens = finiteNonNegativeTokenCount(valueAtPath(usage, path));
    if (tokens !== null) return { tokens, source: path.join('.') };
  }
  return { tokens: null, source: null };
}

/**
 * Build a serializable, per-call prompt-size report. Callers supply the exact
 * authored strings; any separators or provider-facing wrapper text they author
 * belong in one of those strings (normally transportTail). Provider-added
 * material remains visible only as the inferred residual.
 */
export function buildTutorStubPromptSizeReport({
  callId = null,
  provider = null,
  model = null,
  sections = {},
  usage = null,
  tokenizer = TUTOR_STUB_PROMPT_SIZE_TOKENIZER,
  estimateTokens = defaultEstimateTokens,
} = {}) {
  if (typeof estimateTokens !== 'function') {
    throw new TypeError('Prompt-size estimateTokens must be a function.');
  }
  const tokenizerDescriptor = serializableTokenizerDescriptor(tokenizer);
  const authoredTexts = [];
  const sectionReports = TUTOR_STUB_PROMPT_SIZE_SECTIONS.map((definition) => {
    const text = sectionText(sections, definition);
    authoredTexts.push(text);
    return {
      id: definition.id,
      label: definition.label,
      measurement: 'estimated',
      tokenizer: { ...tokenizerDescriptor },
      ...measuredText(text, estimateTokens),
    };
  });

  const authoredText = authoredTexts.join('');
  const authoredMeasurement = measuredText(authoredText, estimateTokens);
  const observed = tutorStubObservedProviderInput(usage);
  const residualTokens =
    observed.tokens === null ? null : observed.tokens - authoredMeasurement.estimatedTokens;

  return {
    schema: TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA,
    callId,
    provider,
    model,
    tokenizer: tokenizerDescriptor,
    sections: sectionReports,
    authoredTotal: {
      id: 'authored_total',
      label: 'Authored total',
      measurement: 'estimated',
      tokenizer: { ...tokenizerDescriptor },
      ...authoredMeasurement,
      sectionEstimatedTokensSum: sectionReports.reduce(
        (sum, section) => sum + section.estimatedTokens,
        0,
      ),
    },
    observedProviderInput: {
      id: 'observed_provider_input',
      label: 'Observed provider input',
      measurement: 'provider_observed',
      tokens: observed.tokens,
      source: observed.source,
      tokenizer: null,
    },
    inferredResidual: {
      id: 'inferred_residual',
      label: 'Inferred residual',
      measurement: 'inferred_observed_minus_estimated',
      tokens: residualTokens,
      observedTokens: observed.tokens,
      authoredEstimatedTokens: authoredMeasurement.estimatedTokens,
      tokenizer: { ...tokenizerDescriptor },
    },
  };
}

export function buildTutorStubPromptSizeReportForRequest({
  callId = null,
  provider = null,
  model = null,
  request = {},
  usage = null,
  structuredOutput = false,
  tokenizer = TUTOR_STUB_PROMPT_SIZE_TOKENIZER,
  estimateTokens = defaultEstimateTokens,
} = {}) {
  return buildTutorStubPromptSizeReport({
    callId,
    provider,
    model,
    sections: tutorStubPromptSizeSectionsFromRequest({
      systemPrompt: request?.systemPrompt || '',
      messages: request?.messages || [],
      structuredOutput,
    }),
    usage,
    tokenizer,
    estimateTokens,
  });
}
