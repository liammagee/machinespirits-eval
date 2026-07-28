import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTOR_STUB_SCAFFOLD_STATE_SCHEMA, projectTutorStubScaffoldState } from '../services/tutorStubScaffoldState.js';

const branch = {
  id: 'clue_branch',
  localQuestion: 'What does this clue establish?',
  warrantFrame: 'State the public bridge.',
  joinReminder: 'Keep the conclusion open.',
};

test('scaffold projection preserves the defeasible public release contract', () => {
  const longSurface = `  public   clue ${'x'.repeat(230)}  `;
  const projected = projectTutorStubScaffoldState({
    dagMode: 'defeasible_human_scaffold',
    tutorTurn: 3,
    activeAct: { act: 2, title: 'Pressure' },
    branch,
    dueNow: [{ premise: 'p2', turn: 3, via: 'scene', surface: longSurface }],
    released: [
      { premise: 'p1', turn: 1, via: 'witness', surface: 'First clue' },
      { premise: 'p2', turn: 3, via: 'scene', surface: longSurface },
    ],
    nextRelease: { premise: 'private-id', turn: 5, via: 'ledger', surface: 'private future clue' },
  });

  assert.equal(projected.schema, TUTOR_STUB_SCAFFOLD_STATE_SCHEMA);
  assert.equal(projected.enabled, true);
  assert.equal(projected.source, 'dramaturgy_release_projection');
  assert.equal(projected.releaseState.releasedCount, 2);
  assert.equal(projected.releaseState.dueNow[0].surface.length, 220);
  assert.match(projected.releaseState.dueNow[0].surface, /\.\.\.$/u);
  assert.deepEqual(projected.releaseState.nextRelease, { turn: 5, via: 'ledger' });
  assert.equal(Object.hasOwn(projected.releaseState.nextRelease, 'premise'), false);
  assert.equal(Object.hasOwn(projected.releaseState.nextRelease, 'surface'), false);
  assert.equal(projected.returnTarget.kind, 'current_release');
  assert.equal(projected.returnTarget.prompt, branch.localQuestion);
  assert.match(projected.modeNote, /compressed local leaps/u);
});

test('scaffold projection preserves strict-mode suppression', () => {
  const projected = projectTutorStubScaffoldState({
    dagMode: 'strict_dag',
    tutorTurn: 1,
    branch,
    released: [{ premise: 'p1', surface: 'Public' }],
  });

  assert.equal(projected.enabled, false);
  assert.equal(projected.source, 'strict_dag_disabled');
  assert.equal(projected.localQuestion, null);
  assert.equal(projected.warrantFrame, null);
  assert.equal(projected.joinReminder, null);
  assert.equal(projected.returnTarget, null);
  assert.equal(projected.status, 'not_enabled_strict_dag');
  assert.match(projected.modeNote, /Strict audit mode/u);
});

test('scaffold projection distinguishes conclusion joins from local branches', () => {
  const projected = projectTutorStubScaffoldState({
    dagMode: 'human_scaffold',
    tutorTurn: 4,
    branch: { ...branch, id: 'world_conclusion_join' },
  });

  assert.equal(projected.returnTarget.kind, 'join_warrant');
  assert.match(projected.modeNote, /one local warrant/u);
});
