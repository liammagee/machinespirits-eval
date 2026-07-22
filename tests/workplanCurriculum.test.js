import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildWorkplanCurriculum } from '../services/curriculum/workplanCurriculum.js';
import {
  loadTutorStubCurriculum,
  renderTutorStubCurriculumModule,
  selectTutorStubCurriculumModule,
} from '../services/curriculum/tutorStubCurriculum.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeItem(itemsDir, item) {
  const dependsOn = item.dependsOn?.length
    ? `depends_on:\n${item.dependsOn.map((id) => `  - ${id}`).join('\n')}\n`
    : '';
  fs.writeFileSync(
    path.join(itemsDir, `${item.id}.md`),
    `---
id: ${item.id}
title: ${item.title}
status: ${item.status}
type: research
priority: ${item.priority || 'P2'}
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: ${item.verification}
${dependsOn}---

${item.body || 'The project needs a concrete account of this decision and its evidence.'}

Acceptance:

- State the mechanism.
- Name the independent check.
`,
  );
}

test('workplan projection produces an open, dependency-ordered canonical curriculum', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workplan-curriculum-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const itemsDir = path.join(root, 'workplan', 'items');
  fs.mkdirSync(itemsDir, { recursive: true });
  writeItem(itemsDir, {
    id: 'foundation-card',
    title: 'Establish the foundation',
    status: 'active',
    priority: 'P1',
    verification: 'The foundation test passes.',
  });
  writeItem(itemsDir, {
    id: 'dependent-card',
    title: 'Use the foundation',
    status: 'review',
    priority: 'P0',
    verification: 'The integration check passes.',
    dependsOn: ['foundation-card'],
  });
  writeItem(itemsDir, {
    id: 'settled-card',
    title: 'Already settled',
    status: 'done',
    verification: 'The historical check passed.',
  });

  const curriculum = buildWorkplanCurriculum({ itemsDir });
  assert.deepEqual(
    curriculum.modules.map((module) => module.id),
    ['foundation-card', 'dependent-card'],
  );
  assert.deepEqual(curriculum.associations, [
    { from: 'foundation-card', to: 'dependent-card', relation: 'prerequisite_of' },
  ]);
  assert.match(curriculum.source.source_hash, /^sha256:[a-f0-9]{64}$/u);
  assert.match(curriculum.projection_boundary, /cannot verify its own advice/u);
  assert.ok(
    curriculum.modules[0].canonical_tasks.some((task) => task === 'State the mechanism.'),
    'acceptance bullets should remain intact as inquiry tasks',
  );
});

test('tutor-stub curriculum rendering keeps project completion external to dialogue', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-curriculum-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const itemsDir = path.join(root, 'workplan', 'items');
  fs.mkdirSync(itemsDir, { recursive: true });
  writeItem(itemsDir, {
    id: 'reflective-card',
    title: 'Test the tutor through itself',
    status: 'triaged',
    verification: 'An independent test demonstrates the behavior.',
  });

  const bundle = loadTutorStubCurriculum('workplan', { root });
  const module = selectTutorStubCurriculumModule(bundle, 'reflective');
  const prompt = renderTutorStubCurriculumModule(bundle, module);
  assert.equal(module.id, 'reflective-card');
  assert.match(prompt, /Actual workplan completion gate/u);
  assert.match(prompt, /An independent test demonstrates the behavior/u);
  assert.match(prompt, /Do not claim the workplan item is complete/u);
});

test('tutor-stub dry-run loads a live workplan module without a world or model call', () => {
  const liveCurriculum = loadTutorStubCurriculum('workplan', { root: ROOT });
  const moduleId = liveCurriculum.curriculum.modules[0]?.id;
  assert.ok(moduleId, 'the live workplan should expose at least one open curriculum module');
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--dry-run',
      '--no-trace',
      '--no-remember-settings',
      '--curriculum',
      'workplan',
      '--module',
      moduleId,
      '--opening-realizer',
      'deterministic',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const dryRun = JSON.parse(result.stdout);
  assert.equal(dryRun.curriculum.moduleId, moduleId);
  assert.equal(dryRun.curriculum.mode, 'public_reflective_non_dag');
  assert.equal(dryRun.world, null);
  assert.equal(dryRun.promptArchitecture.planner.modelCall, false);
  assert.equal(dryRun.promptArchitecture.audit.baseSystem.ok, true);
  assert.equal(dryRun.promptArchitecture.audit.baseSpeakerPrivilege.ok, true);
});
