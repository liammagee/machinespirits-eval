import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
  tutorStubFirstPersonRoleVoiceVisible,
  tutorStubRoleStageDirectionVisible,
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
  assert.match(prompt, /Make its arrival audible or visible inside the scene/u);
  assert.match(prompt, /Enact it from inside this role: watchman/u);
  assert.match(prompt, /Never say “let’s role-play/u);
  assert.doesNotMatch(prompt, /p_watch/u);

  const performed = auditTutorStubDramaticReleaseResponse({
    frame,
    text: [
      '“I had the midnight watch, and I saw the shutters closed after midnight.”',
      'What does that change?',
    ].join(' '),
  });
  assert.equal(performed.ok, true);
  assert.equal(performed.metaRoleplayAnnouncement, false);
  assert.equal(performed.firstPersonRoleVoice, true);
});

test('a role label and stage direction do not count as speaking in character', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crew',
        via: 'director',
        surface: 'Visitor code WF-11 was issued to an outside crew in hi-vis.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
  });
  const text =
    'Front-desk clerk reading the visitor badge log, making room beside the open visitor badge log: “One more badge in the noon window: a visitor code, WF-11, issued at the front desk to an outside crew in hi-vis.” How does that change your reading?';
  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });

  assert.equal(tutorStubRoleStageDirectionVisible({ text, frame }), true);
  assert.equal(tutorStubFirstPersonRoleVoiceVisible(text), false);
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'role_label_stage_direction'));
  assert.ok(audit.issues.some((issue) => issue.type === 'missing_in_scene_enactment'));
});

test('announcing role-play fails even when the clue and return question are present', () => {
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
  const audit = auditTutorStubDramaticReleaseResponse({
    frame,
    text: "I'm going to give you another piece of information. Let's role-play it: I'll be the watchman. The shutters were closed after midnight. Back to us: what does this change?",
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.metaRoleplayAnnouncement, true);
  assert.ok(audit.issues.some((issue) => issue.type === 'meta_dramatic_announcement'));
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
    ['opaque_clue_release', 'missing_in_scene_enactment'],
  );
});

test('handling a record generically does not count as performing its authored source', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_log',
        via: 'director',
        surface: 'Visitor code WF-11 was issued to an outside crew.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
  });
  const audit = auditTutorStubDramaticReleaseResponse({
    frame,
    text: 'I open the visitor badge log at WF-11. What does this entry change?',
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.enactmentVisible, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'missing_in_scene_enactment'));
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
        'I put the assay report in front of us and read its finding: copper is mixed through the silver.',
        'What does this evidence rule out?',
      ].join(' '),
    }).ok,
    true,
  );
});

test('forceful but concrete exhibit handling remains an in-scene release', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_noon',
        via: 'tutor',
        surface: 'The badge log places Dario in the kitchen at 12:02.',
      },
    ],
  });
  const text =
    'I slap the badge log beside the kettle and read: “Dario entered the kitchen at 12:02.” What does that prove?';

  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });
  assert.equal(audit.ok, true);
  assert.equal(audit.exhibitHandoffVisible, true);
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
    uptake: 'Yes—the badge establishes access, not guilt.',
    responseConfiguration: { engagement_stance: 'precise' },
    variationKey: 'run-a:t005',
  });

  assert.match(text, /^Yes—the badge establishes access, not guilt\. /u);
  assert.match(text, /“(?:I|My)\b/u);
  assert.match(text, /exact line|exact limit|line that matters|limit of what/u);
  assert.match(text, /ask me to unpack/u);
  assert.doesNotMatch(text, /role-play|I’ll be|another piece of information|Back to us/iu);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('fallback realization varies reproducibly across run keys while preserving the selected stance', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crew',
        via: 'director',
        surface: 'Visitor code WF-11 was issued to an outside crew in hi-vis.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
  });
  const variants = new Set(
    Array.from({ length: 12 }, (_, index) =>
      deterministicTutorStubDramaticReleaseFallback({
        frame,
        responseConfiguration: { engagement_stance: 'brisk' },
        variationKey: `run-${index}:t003`,
      }),
    ),
  );

  assert.ok(variants.size >= 3);
  for (const text of variants) {
    assert.match(text, /“[^”]*\b(?:I|my|we|our)\b/iu);
    assert.doesNotMatch(text, /front-desk clerk[^.!?]{0,140}(?::|—)/iu);
    assert.match(text, /live line|straight|already open|Your call|move the case|What does that add/iu);
    assert.doesNotMatch(text, /role-play|I’ll be|another piece of information|Back to us/iu);
    assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
  }
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
    '“I signed Monday’s lift notice authorizing the Wrenfold crew to clear appliances.”',
    'What does that add to the badge evidence?',
  ].join(' ');

  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('direct Larkspur performances pass while self-announced casting fails', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crew',
        via: 'director',
        surface: 'Visitor code WF-11 was issued to an outside crew in hi-vis.',
        presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the visitor badge log' },
      },
    ],
  });
  const direct =
    'Exactly—presence makes Dario a suspect, not the person who handled the lunchbox. “I issued one more noon entry at the front desk: visitor code WF-11.” What does that add—and what remains unproved?';
  const meta =
    'Exactly—Dario’s presence keeps him in view. Let’s role-play it: I’ll be the clerk opening the visitor badge log: “Another noon entry—WF-11.” Back to the case: what does that change?';

  assert.equal(auditTutorStubDramaticReleaseResponse({ text: direct, frame }).ok, true);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text: meta, frame }).ok, false);
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
