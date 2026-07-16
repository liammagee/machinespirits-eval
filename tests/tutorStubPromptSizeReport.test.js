import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubPromptSizeReport,
  buildTutorStubPromptSizeReportForRequest,
  summarizeTutorStubPromptSizeReports,
  TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA,
  TUTOR_STUB_PROMPT_SIZE_SECTIONS,
  tutorStubPromptSizeSectionsFromRequest,
  tutorStubObservedProviderInput,
} from '../services/tutorStubPromptSizeReport.js';
import { buildCodexCliPromptText } from '../services/cliProviderBridge.js';

test('prompt-size report emits every required section in stable order', () => {
  const report = buildTutorStubPromptSizeReport({
    callId: 'turn-5:original',
    provider: 'codex',
    model: 'gpt-5.6-sol',
    sections: {
      baseTutorRules: 'abcd',
      world_scene: 'efgh',
      evidenceSafety: 'ijkl',
      namedTutor: 'mnop',
      publicHistory: 'qrst',
      publicEvidenceWindow: 'uvwx',
      classifier: 'yz12',
      learnerDag: '3456',
      scaffold: '7890',
      hostPlan: 'ABCD',
      transportTail: 'EFGH',
    },
  });

  assert.equal(report.schema, TUTOR_STUB_PROMPT_SIZE_REPORT_SCHEMA);
  assert.deepEqual(
    report.sections.map((section) => section.id),
    TUTOR_STUB_PROMPT_SIZE_SECTIONS.map((section) => section.id),
  );
  assert.equal(report.sections.length, 11);
  assert.ok(report.sections.every((section) => section.measurement === 'estimated'));
  assert.ok(report.sections.every((section) => section.estimatedTokens === 1));
  assert.equal(report.authoredTotal.chars, 44);
  assert.equal(report.authoredTotal.estimatedTokens, 11);
  assert.equal(report.authoredTotal.sectionEstimatedTokensSum, 11);
  assert.equal(report.tokenizer.kind, 'heuristic');
  assert.equal(report.authoredTotal.tokenizer.id, report.tokenizer.id);
});

test('missing provider usage remains null rather than becoming a false zero', () => {
  const report = buildTutorStubPromptSizeReport({ sections: { baseTutorRules: 'abcd' } });

  assert.deepEqual(report.observedProviderInput, {
    id: 'observed_provider_input',
    label: 'Observed provider input',
    measurement: 'provider_observed',
    tokens: null,
    source: null,
    tokenizer: null,
  });
  assert.equal(report.inferredResidual.tokens, null);
  assert.equal(report.inferredResidual.observedTokens, null);
});

test('provider usage aliases are normalized and retain the exact source path', () => {
  assert.deepEqual(tutorStubObservedProviderInput({ usage: { input_tokens: 17 } }), {
    tokens: 17,
    source: 'usage.input_tokens',
  });
  assert.deepEqual(tutorStubObservedProviderInput({ usageMetadata: { promptTokenCount: 23 } }), {
    tokens: 23,
    source: 'usageMetadata.promptTokenCount',
  });

  const report = buildTutorStubPromptSizeReport({
    sections: { baseTutorRules: 'abcdefgh' },
    usage: { inputTokens: 12 },
  });
  assert.equal(report.authoredTotal.estimatedTokens, 2);
  assert.equal(report.observedProviderInput.tokens, 12);
  assert.equal(report.observedProviderInput.source, 'inputTokens');
  assert.equal(report.inferredResidual.tokens, 10);
});

test('explicit observed zero remains distinguishable from missing usage', () => {
  const report = buildTutorStubPromptSizeReport({ usage: { prompt_tokens: 0 } });

  assert.equal(report.observedProviderInput.tokens, 0);
  assert.equal(report.observedProviderInput.source, 'prompt_tokens');
  assert.equal(report.inferredResidual.tokens, 0);
});

test('custom estimates are labeled with their recorded tokenizer', () => {
  const report = buildTutorStubPromptSizeReport({
    sections: { classifier: 'one two three', transportTail: ' four' },
    tokenizer: {
      id: 'test-word-tokenizer',
      kind: 'test_exact',
      version: '7',
      ignoredFunction: () => 'not serialized',
    },
    estimateTokens: (text) => (text.trim() ? text.trim().split(/\s+/u).length : 0),
    usage: { usage: { prompt_tokens: 8 } },
  });

  assert.deepEqual(report.tokenizer, {
    id: 'test-word-tokenizer',
    kind: 'test_exact',
    version: '7',
  });
  assert.equal(report.authoredTotal.estimatedTokens, 4);
  assert.equal(report.observedProviderInput.tokens, 8);
  assert.equal(report.inferredResidual.tokens, 4);
  assert.equal(report.inferredResidual.measurement, 'inferred_observed_minus_estimated');
});

test('section values fail fast instead of silently stringifying structured prompts', () => {
  assert.throws(
    () => buildTutorStubPromptSizeReport({ sections: { publicHistory: [{ role: 'user' }] } }),
    /public_history must be a string/u,
  );
});

test('request partition matches the exact Codex bridge prompt and separates tagged layers', () => {
  const request = {
    systemPrompt: [
      'BASE',
      '# Detective-story world',
      'WORLD',
      '# Speaking-tutor evidence contract',
      'SAFE',
      '[Named tutor instance: Named (named)]',
      'NAMED',
    ].join('\n'),
    messages: [
      { role: 'assistant', content: 'Opening.' },
      { role: 'user', content: 'Earlier question.' },
      {
        role: 'user',
        content: [
          '[Tutor context continuity]\nTwo turns.\n[End tutor context continuity]',
          '[Tutor-only public evidence window]\nEvidence.\n[End tutor-only public evidence window]',
          '[Tutor-only learner classifier]\nClassifier.\n[End tutor-only learner classifier]',
          '[Tutor-only redacted learner-DAG model]\nDAG.\n[End tutor-only redacted learner-DAG model]',
          '[Tutor-only human discourse scaffold]\nScaffold.\n[End tutor-only human discourse scaffold]',
          '[Tutor-only joint-performance host plan]\nPlan.\n[End tutor-only joint-performance host plan]',
          'Learner says:\nLatest question?',
        ].join('\n\n'),
      },
    ],
  };
  const sections = tutorStubPromptSizeSectionsFromRequest(request);
  const report = buildTutorStubPromptSizeReportForRequest({ request });
  const latest = request.messages.at(-1);
  const exact = buildCodexCliPromptText({
    systemPrompt: request.systemPrompt,
    userPrompt: latest.content,
    messageHistory: request.messages.slice(0, -1),
  });

  assert.equal(report.authoredTotal.chars, exact.length);
  assert.equal(
    report.sections.reduce((sum, section) => sum + section.chars, 0),
    exact.length,
  );
  assert.match(sections.publicEvidenceWindow, /Evidence\./u);
  assert.match(sections.classifier, /Classifier\./u);
  assert.match(sections.learnerDag, /DAG\./u);
  assert.match(sections.scaffold, /Scaffold\./u);
  assert.match(sections.hostPlan, /Plan\./u);
  assert.match(sections.transportTail, /Tutor context continuity/u);
  assert.match(sections.transportTail, /Latest question\?/u);
});

test('prompt-size summaries require complete observed usage and preserve inferred residuals', () => {
  const request = { systemPrompt: 'abcd', messages: [{ role: 'user', content: 'efgh' }] };
  const first = buildTutorStubPromptSizeReportForRequest({ request, usage: { inputTokens: 20 } });
  const second = buildTutorStubPromptSizeReportForRequest({ request, usage: { inputTokens: 24 } });
  const complete = summarizeTutorStubPromptSizeReports([first, second]);
  assert.equal(complete.calls, 2);
  assert.equal(complete.observedProviderInputComplete, true);
  assert.equal(complete.totalObservedProviderInputTokens, 44);
  assert.equal(complete.inferredResidualComplete, true);

  const incomplete = summarizeTutorStubPromptSizeReports([
    first,
    buildTutorStubPromptSizeReportForRequest({ request }),
  ]);
  assert.equal(incomplete.observedProviderInputComplete, false);
  assert.equal(incomplete.totalObservedProviderInputTokens, null);
  assert.equal(incomplete.totalInferredResidualTokens, null);
});
