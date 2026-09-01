#!/usr/bin/env node
// Zero-call rendering of this preserved stopped re-test, not a recovery runner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBenchmarkArm } from './score-local-qwen-resistant-learner-benchmark.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.join(root, '.tutor-stub-traces/qwen-refusal-continuity-v1');
const out = path.join(archive, process.argv[2] || 'review-v1');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name, data) =>
  fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
const plan = read(path.join(archive, 'plan.json'));
const stopped = read(path.join(archive, 'stopped.json'));
const failed = read(path.join(archive, 'B/1-learner.response.json'));
if (stopped.budget.used !== 3 || fs.existsSync(path.join(archive, 'evaluation')))
  throw new Error('not the observed three-attempt stop');
fs.mkdirSync(out, { recursive: false });
write('B-incomplete.json', {
  turns: [],
  trace: path.join(archive, 'B/trace.jsonl'),
  ledgers: null,
  maxExchanges: 8,
  disposition: 'generation_failure',
  incomplete: true,
});
const arms = plan.arms.map((arm) =>
  readBenchmarkArm({
    ...arm,
    path: arm.id === 'A' ? path.join(archive, 'A/dialogue.json') : path.join(out, 'B-incomplete.json'),
  }),
);
const baseline = read(
  path.join(
    root,
    '.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/final-four-v1/completion/report-v2/report-data.json',
  ),
);
const observations = [
  'Normal Qwen refused the assigned role and dismissed the housemate immediately. Sol accepted that boundary and offered to contact a plumber. This is a coherent exit, not evidence of sustained resistance or of Alex responding to a concession on a later turn.',
  'Normal Qwen was blunt and confrontational, but the single short reply does not demonstrate the requested range of mockery, sarcasm or evolving tactics. A zero duplicate count with one reply cannot establish nonrepetition.',
  'The abliterated checkpoint returned an ordinary causal answer rather than Alex’s goal-directed refusal, and omitted both continuity notes and the ending signal. This is a joint role/format failure on one attempt, not just punctuation around otherwise complete structured data.',
  'The new bookkeeping requirement is itself an additional instruction-following burden introduced by this implementation. We cannot attribute this failure to abliteration generally or claim that the four-change bundle improves overall quality.',
  'Read-only diagnosis: the failed response reported 741 input tokens and zero cached tokens. Rendering the exact saved messages with the local tokenizer and thinking disabled also produced 741 tokens and retained the complete character, output instructions and latest task. That supports intact delivery; it does not reveal the model’s internal cause.',
  'The caller used a nested thinking flag that this server ignores. The server’s actual default and reconstructed template were already thinking-off; the source now sends the correct explicit top-level flag. No result was rerun or retrospectively relabelled because of this cleanup.',
  'The next design question is how to keep continuity without making successful roleplay depend on Qwen producing a structured bookkeeping object. That would need a prospective choice, not silently interpreting this failed reply as valid.',
];
const result = {
  arms,
  baseline,
  characterBrief: plan.characterBrief,
  observations,
  failures: [
    {
      arm: 'Abliterated Qwen',
      turn: 1,
      text: failed.text,
      latencyMs: failed.latencyMs,
      reason:
        'The reply omitted the required continuity object and ending signal. It was not delivered to Sol; generation stopped without retry.',
    },
  ],
  evaluation: { scores: [], stopReason: stopped.error, assessmentsPlanned: 8, assessmentsAttempted: 0 },
  provenance: {
    ...plan.provenance,
    budget: stopped.budget,
    completedModelCalls: 2,
    failedModelCalls: 1,
    completedDialogues: 1,
    failedDialogues: 1,
    opusCalls: 0,
    rawArtifactsPreserved: true,
    solObservedResponses: 1,
    localResponses: 2,
    modelServiceStopped: true,
    note: 'Failed B response remains separate from the public transcript; no continuity fields were fabricated.',
  },
};
write('report-data.json', result);
const report = renderContinuityReport(result);
fs.writeFileSync(path.join(out, 'report.html'), report.html, { flag: 'wx' });
write('public-dialogues.json', report.interchange);
write('diagnosis.json', {
  matchingOfflineTokenCount: 741,
  fullSystemAndTaskRetained: true,
  failedResponseCachedTokens: 0,
  modelCallsMadeByDiagnosis: 0,
  sourceThinkingFlagCorrected: true,
  conclusion: 'No demonstrated delivery defect justifying retry. Preserve failed role/format response.',
});
console.log(path.join(out, 'report.html'));
