import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
  tutorStubDramaticReleasePrompt,
} from '../services/tutorStubDramaticRelease.js';

test('director evidence becomes an enacted in-scene release', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_watch',
        via: 'director',
        surface: 'The watchman saw the shutters closed after midnight.',
        presentation: { mode: 'enacted_role', role: 'watchman' },
      },
    ],
  });

  assert.equal(frame.active, true);
  assert.equal(frame.requiresEnactment, true);
  assert.equal(frame.entries[0].role, 'watchman');
  const prompt = tutorStubDramaticReleasePrompt(frame);
  assert.match(prompt, /Make that transition audible/u);
  assert.match(prompt, /Enact it as: watchman/u);
  assert.doesNotMatch(prompt, /p_watch/u);

  const performed = auditTutorStubDramaticReleaseResponse({
    frame,
    text: [
      "I'm going to bring in another piece of information.",
      "Let's role-play it: I'll be the watchman. I saw the shutters closed after midnight.",
      'Back to the case: what does this change?',
    ].join(' '),
  });
  assert.equal(performed.ok, true);
});

test('an opaque clue dump fails the dramatic release check', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_log',
        via: 'director',
        surface: 'The queue log names Quist as the runner.',
      },
    ],
  });
  const audit = auditTutorStubDramaticReleaseResponse({
    frame,
    text: 'The queue log names Quist as the runner. Who does that identify?',
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.issues.map((issue) => issue.type),
    ['opaque_clue_release', 'missing_in_scene_enactment', 'missing_return_to_inquiry'],
  );
});

test('tutor evidence is visibly presented as an exhibit', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_assay',
        via: 'tutor',
        surface: 'The assay shows copper mixed through the silver.',
      },
    ],
  });
  assert.equal(frame.requiresExhibitHandoff, true);
  assert.equal(
    auditTutorStubDramaticReleaseResponse({
      frame,
      text: [
        "I'm going to show you another piece of evidence.",
        'I put the assay report in front of us and read its finding: copper is mixed through the silver.',
        'Now, what does this new evidence rule out?',
      ].join(' '),
    }).ok,
    true,
  );
});

test('the deterministic release fallback performs the complete handoff', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_notice',
        via: 'director',
        surface: 'The lift notice authorizes Wrenfold to clear appliances.',
        presentation: { mode: 'enacted_role', role: 'building manager' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    support: { clarificationInvitationRequired: true },
  });

  assert.match(text, /another piece of information/u);
  assert.match(text, /role-play/u);
  assert.match(text, /building manager/u);
  assert.match(text, /ask me to unpack/u);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('natural handoff and role-reading language from the live transcript passes', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_notice',
        via: 'director',
        surface: 'The lift notice authorizes Wrenfold to clear appliances.',
        presentation: { mode: 'enacted_role', role: 'building manager' },
      },
    ],
  });
  const text = [
    'Yes. The badge log shows entry; appliance-clearance authority needs separate evidence.',
    'I’m bringing in the lift notice now, with the building manager reading: “Monday’s notice authorizes the Wrenfold crew to clear appliances.”',
    'What does that add to the badge evidence?',
  ].join(' ');

  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('the release fallback keeps an unanswered-question repair visible', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_log',
        via: 'director',
        surface: 'The badge log records the visitor crew entering the kitchen.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    support: { responsiveRepairRequired: true },
  });

  assert.match(text, /did not answer your question directly/u);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});
