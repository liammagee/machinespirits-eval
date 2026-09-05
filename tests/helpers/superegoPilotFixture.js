import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { DESIGN_PATH, loadPilotDesign, preparePilot } from '../../services/superegoContemporaryPilot.js';
import { writeOnce } from '../../services/superegoCritiqueCausalReplay.js';

// Legacy and prospective modes are tested independently; no historical artifact is relabeled.
export const root = process.cwd();
export const proposedDesign = loadPilotDesign(root);
export const realDesign = structuredClone(proposedDesign);
for (const key of ['public_output_format', 'generation_failure_policy', 'automated_judging']) delete realDesign[key];
realDesign.id = 'superego-contemporary-pilot';
realDesign.master_seed = 202609051;
realDesign.max_dollars = 20;
realDesign.models.judging = {
  provider: 'openai',
  model: 'gpt-5.6-sol',
  endpoint: 'https://api.openai.com/v1/responses',
  input_per_million: 4,
  output_per_million: 20,
};
realDesign.attempts = {
  generation_planned: 60,
  quality_planned: 48,
  semantic_planned: 48,
  total_planned: 156,
  generation_reserve: 6,
  quality_reserve: 3,
  semantic_reserve: 3,
  recovery_reserve: 12,
  hard_ceiling: 168,
};
export const rating = (kind) =>
  kind === 'quality'
    ? {
        quality: 7,
        accuracy: 5,
        candidate_refs: ['P1'],
        rationale: 'The supplied paragraph supports this fixture judgment.',
      }
    : {
        directive_fulfillment: 'full',
        material_change: 'action_only',
        critique_refs: ['C1'],
        candidate_refs: ['P1'],
        rationale: 'The task is fulfilled by paraphrase in this fixture.',
      };
export function answer(request, modify = (v) => v) {
  const generation = request.provider === 'anthropic';
  const schema = generation ? request.body.output_config?.format.schema : request.body.text.format.schema;
  const kind = schema?.properties.directives
    ? 'critique'
    : !schema || schema.properties.response
      ? 'draft'
      : schema.properties.quality
        ? 'quality'
        : 'semantic';
  const value = modify(
    kind === 'critique'
      ? {
          directives: ['Ask the learner to choose a concrete example.'],
          rationale: 'A concrete task can reveal the reasoning.',
        }
      : kind === 'draft'
        ? { response: 'You’re considering recognition. Which example would help us examine your interpretation?' }
        : rating(kind),
  );
  const envelope = generation
    ? {
        model: request.body.model,
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: !schema && generation ? value.response : JSON.stringify(value) }],
        usage: { input_tokens: 500, output_tokens: 100 },
      }
    : {
        model: request.body.model,
        status: 'completed',
        output: [
          { type: 'reasoning' },
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
        ],
        usage: { input_tokens: 500, output_tokens: 100 },
      };
  return { status: 200, request_id: 'offline-fixture', body: JSON.stringify(envelope) };
}
export function fixture(t, { prospective = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contemporary-pilot-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const design = structuredClone(prospective ? proposedDesign : realDesign);
  design.scenarios = design.scenarios.slice(0, 2);
  design.sample_size = 4;
  design.attempts = {
    generation_planned: 20,
    quality_planned: 16,
    semantic_planned: 16,
    total_planned: 52,
    generation_reserve: 2,
    quality_reserve: 2,
    semantic_reserve: 2,
    recovery_reserve: 6,
    hard_ceiling: 58,
  };
  if (prospective) {
    design.public_output_format = 'text';
    design.generation_failure_policy = 'retain_missing';
    design.automated_judging = false;
    design.attempts = {
      generation_planned: 20,
      quality_planned: 0,
      semantic_planned: 0,
      total_planned: 20,
      generation_reserve: 2,
      quality_reserve: 0,
      semantic_reserve: 0,
      recovery_reserve: 2,
      hard_ceiling: 22,
    };
  }
  fs.mkdirSync(path.join(dir, 'notes'));
  fs.mkdirSync(path.join(dir, 'config'));
  fs.copyFileSync(path.join(root, design.scenario_source), path.join(dir, design.scenario_source));
  fs.writeFileSync(
    path.join(dir, DESIGN_PATH),
    `# Offline fixture\n\n\`\`\`yaml study\n${JSON.stringify(design)}\n\`\`\`\n`,
  );
  fs.writeFileSync(
    path.join(dir, 'notes/test-go.md'),
    `GO\nOffline fixture; no real authority.\n${DESIGN_PATH}\n$${design.max_dollars}; ${design.attempts.hard_ceiling} attempts.\n`,
  );
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Offline Test');
  git('config', 'user.email', 'test@example.invalid');
  git('add', 'notes', 'config');
  git('commit', '-m', 'Offline fixtures');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  return {
    root: dir,
    design,
    plan: preparePilot(dir, design),
    destination: path.join(dir, 'generation'),
    goNotePath: 'notes/test-go.md',
    studyStateRoot: path.join(dir, 'study-state'),
    signalTarget: new EventEmitter(),
    dispatch: async (request) => answer(request),
  };
}
export function humans(f) {
  const qualityPath = path.join(f.root, 'quality.json'),
    semanticPath = path.join(f.root, 'semantic.json');
  for (const [category, file] of [
    ['quality', qualityPath],
    ['semantic', semanticPath],
  ])
    writeOnce(file, {
      raters: ['reader-a', 'reader-b'].map((coder_id) => ({
        coder_id,
        completed_at: category === 'quality' ? '2026-01-01T12:00:00Z' : '2026-01-02T12:00:00Z',
        ratings: f.plan.presentations[category].map((p) => ({ id: p.id, rating: rating(category) })),
      })),
    });
  return { qualityPath, semanticPath };
}
export function transport(code = 'UND_ERR_SOCKET') {
  const error = new Error(`Transport dispatch: TypeError/${code}`);
  error.recoverable = true;
  error.diagnostic = { name: 'TypeError', cause_code: code, stage: 'dispatch', request_id: null };
  return error;
}
