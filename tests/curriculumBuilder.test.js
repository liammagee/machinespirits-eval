import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  buildCurriculumFromBrief,
  compileCurriculumBuilderBundle,
  curriculumBuilderDraftPrompt,
  extractCurriculumWebText,
  loadCurriculumSourceMaterials,
  parseCurriculumBuilderDraftResponse,
  renderCurriculumBuilderReport,
  validateCurriculumBuilderCurriculum,
} from '../services/curriculum/curriculumBuilder.js';
import { parseArgs, usage } from '../scripts/curriculum-builder.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE_BRIEF = path.join(ROOT, 'curriculum', 'examples', 'evidence-reasoning.brief.yaml');

function brief() {
  return yaml.parse(fs.readFileSync(EXAMPLE_BRIEF, 'utf8'));
}

test('curriculum builder help documents authored, sourced, generated, and compile paths', () => {
  const help = usage();
  assert.match(help, /--brief <path>/u);
  assert.match(help, /--source <url>/u);
  assert.match(help, /--generate/u);
  assert.match(help, /--dry-run/u);
  assert.match(help, /World specs constrain tutor action/u);

  const args = parseArgs([
    '--brief',
    EXAMPLE_BRIEF,
    '--source',
    'https://example.org/a',
    '--source',
    'https://example.org/b',
    '--module-count',
    '4',
    '--rhetorical',
  ]);
  assert.equal(args.brief, EXAMPLE_BRIEF);
  assert.deepEqual(args.sources, ['https://example.org/a', 'https://example.org/b']);
  assert.equal(args.moduleCount, 4);
  assert.equal(args.rhetorical, true);
  assert.equal(args.compile, true);
});

test('builder creates a runtime-ready canonical curriculum and prerequisite DAG', () => {
  const curriculum = buildCurriculumFromBrief(brief(), {
    createdAt: '2026-07-12T00:00:00.000Z',
    date: '2026-07-12',
  });
  const validation = validateCurriculumBuilderCurriculum(curriculum);

  assert.equal(curriculum.schema_version, 'ms-curriculum-v0.1');
  assert.equal(curriculum.discipline, 'evidence_reasoning');
  assert.equal(validation.moduleCount, 2);
  assert.equal(validation.knowledgeComponentCount, 6);
  assert.deepEqual(validation.topologicalOrder, ['ER1', 'ER2']);
  assert.deepEqual(curriculum.associations, [{ from: 'ER1', to: 'ER2', relation: 'prerequisite_of' }]);
  assert.ok(curriculum.modules.every((module) => module.verifiers.length && module.misconception_signatures.length));
});

test('builder rejects cyclic prerequisite graphs', () => {
  const cyclic = brief();
  cyclic.modules[0].prerequisite_ids = ['ER2'];
  assert.throws(() => buildCurriculumFromBrief(cyclic), /contains a cycle involving/u);
});

test('web extraction records source provenance without treating it as verifier evidence', async () => {
  const html = `<!doctype html><html><head><title>Evidence Standard</title><style>hidden</style></head>
    <body><nav>menu</nav><article><h1>Claims</h1><p>A claim needs a checkable warrant &amp; bounded scope.</p></article></body></html>`;
  const extracted = extractCurriculumWebText(html);
  assert.equal(extracted.title, 'Evidence Standard');
  assert.match(extracted.text, /checkable warrant & bounded scope/u);
  assert.doesNotMatch(extracted.text, /hidden|menu/u);

  const materials = await loadCurriculumSourceMaterials(
    { urls: ['https://example.org/evidence'] },
    {
      fetchImpl: async () =>
        new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      now: () => new Date('2026-07-12T00:00:00.000Z'),
    },
  );
  assert.equal(materials[0].id, 'REF01');
  assert.equal(materials[0].title, 'Evidence Standard');
  assert.equal(materials[0].accessed_at, '2026-07-12T00:00:00.000Z');
  assert.match(materials[0].content_sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.match(materials[0].content, /checkable warrant/u);
});

test('module source citations resolve against the captured reference ledger', () => {
  const sourced = brief();
  sourced.modules[0].reference_ids = ['REF01'];
  sourced.modules[0].knowledge_components[0] = {
    statement: sourced.modules[0].knowledge_components[0],
    reference_ids: ['REF01'],
  };
  const reference = {
    id: 'REF01',
    type: 'web',
    title: 'Evidence standard',
    url: 'https://example.org/evidence',
    accessed_at: '2026-07-12T00:00:00.000Z',
    content_sha256: `sha256:${'a'.repeat(64)}`,
  };
  const curriculum = buildCurriculumFromBrief(sourced, { references: [reference] });
  assert.deepEqual(curriculum.modules[0].reference_ids, ['REF01']);
  assert.deepEqual(curriculum.modules[0].knowledge_components[0].reference_ids, ['REF01']);

  sourced.modules[0].reference_ids = ['MISSING'];
  assert.throws(
    () => buildCurriculumFromBrief(sourced, { references: [reference] }),
    /references unknown source MISSING/u,
  );
});

test('model drafting prompt and parser keep source ids explicit', () => {
  const prompt = curriculumBuilderDraftPrompt({
    brief: { title: 'Evidence', course_goal: 'Reason well' },
    moduleCount: 2,
    materials: [
      {
        id: 'REF01',
        title: 'Standard',
        url: 'https://example.org',
        content_sha256: 'sha256:abc',
        content: 'Claims need warrants.',
      },
    ],
  });
  assert.match(prompt, /Produce 2 modules/u);
  assert.match(prompt, /REF01: Standard/u);
  assert.match(prompt, /Do not treat a reference as proof/u);
  assert.match(prompt, /prerequisite edge only when/u);
  assert.match(prompt, /same semantic type/u);

  const parsed = parseCurriculumBuilderDraftResponse('```json\n{"title":"Course","modules":[]}\n```');
  assert.equal(parsed.title, 'Course');
});

test('custom curricula compile through the existing world and drama contracts', () => {
  const curriculum = buildCurriculumFromBrief(brief());
  const bundle = compileCurriculumBuilderBundle(curriculum, { rhetorical: true });

  assert.equal(bundle.worlds.world_adaptation_specs.length, 2);
  assert.equal(bundle.dramas.dramas.length, 2);
  assert.equal(bundle.dramas.dramas[0].discipline, 'evidence_reasoning');
  assert.equal(bundle.rhetoricalPlans.rhetorical_dramatic_plans.length, 2);
  assert.equal(bundle.rhetoricalDramas.dramas[0].discipline, 'evidence_reasoning');
  assert.match(bundle.worlds.world_adaptation_specs[0].spec_hash, /^sha256:/u);

  const report = renderCurriculumBuilderReport({
    curriculum,
    validation: bundle.validation,
    outputs: { curriculum: 'curriculum/evidence.curriculum.yaml' },
  });
  assert.match(report, /```mermaid\nflowchart LR/u);
  assert.match(report, /ER1 --> ER2/u);
  assert.match(report, /world specs constrain tutor action/iu);
  assert.match(report, /Scenario-authoring handoff/u);
  assert.match(report, /three distinct graphs/u);
  assert.match(report, /npm run derivation:quality/u);
});

test('curriculum builder CLI help short-circuits and deterministic build writes the complete bundle', () => {
  const help = spawnSync(process.execPath, ['scripts/curriculum-builder.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Curriculum Builder/u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-builder-cli-'));
  try {
    const out = path.join(tmp, 'evidence.curriculum.yaml');
    const result = spawnSync(
      process.execPath,
      ['scripts/curriculum-builder.js', '--brief', EXAMPLE_BRIEF, '--out', out],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /built > Evidence and Reasoning · 2 modules/u);
    assert.match(result.stdout, /DAG > ER1 -> ER2/u);
    for (const fileName of [
      'evidence.curriculum.yaml',
      'evidence.worlds.yaml',
      'evidence.dramas.yaml',
      'evidence.builder-report.md',
    ]) {
      assert.ok(fs.existsSync(path.join(tmp, fileName)), `missing ${fileName}`);
    }
    const curriculum = yaml.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(validateCurriculumBuilderCurriculum(curriculum).valid, true);
    assert.match(fs.readFileSync(path.join(tmp, 'evidence.builder-report.md'), 'utf8'), /ER1 --> ER2/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('--dry-run with --generate plans work without calling a model or writing files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-builder-dry-'));
  try {
    const out = path.join(tmp, 'never-written.curriculum.yaml');
    const result = spawnSync(
      process.execPath,
      ['scripts/curriculum-builder.js', '--brief', EXAMPLE_BRIEF, '--generate', '--dry-run', '--out', out],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: tmp } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /dry run > no model calls or files written/u);
    assert.equal(fs.existsSync(out), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
