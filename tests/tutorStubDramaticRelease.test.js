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
  assert.match(prompt, /begin the source quotation itself with I, My, We, or Our/u);
  assert.match(prompt, /Do not write “as the assayer\/officer\/clerk speaks or says/u);
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
    ['opaque_clue_release', 'missing_exhibit_action'],
  );
});

test('director records default to exhibits while witness accounts default to enacted roles', () => {
  const recordFrame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_history',
        via: 'director',
        surface: 'The version history shows that the kicker was added after filing.',
      },
    ],
  });
  const witnessFrame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_watch',
        via: 'director',
        surface: 'The watchman saw the shutters close after midnight.',
      },
    ],
  });

  assert.equal(recordFrame.entries[0].mode, 'presented_exhibit');
  assert.equal(recordFrame.requiresExhibitHandoff, true);
  assert.equal(witnessFrame.entries[0].mode, 'enacted_role');
  assert.equal(witnessFrame.requiresEnactment, true);
});

test('a report entering the scene and a hand running along a ledger are visible exhibit actions', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_report',
        via: 'director',
        surface: 'The sequencing report identifies strain G17 in the returned incubator.',
      },
    ],
  });
  const arriving = auditTutorStubDramaticReleaseResponse({
    frame,
    text: 'The sequencing report lands beside the incubator: it identifies strain G17 in the returned unit. What does that add?',
  });
  const handled = auditTutorStubDramaticReleaseResponse({
    frame,
    text: 'I run a finger along the sequencing report: it identifies strain G17 in the returned incubator. What does that add?',
  });

  assert.equal(arriving.exhibitHandoffVisible, true);
  assert.equal(arriving.ok, true);
  assert.equal(handled.exhibitHandoffVisible, true);
  assert.equal(handled.ok, true);
});

test('a first-person action on a concrete token from the due exhibit is visibly staged', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_shelf',
        via: 'tutor',
        surface:
          "Devlin labels nothing. The Corvat flasks spent the week on Devlin's shelf, in a row of identical unmarked flasks — no dates, no initials.",
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text =
    'I pull the shelf log beneath the fluorescent light: Devlin labels nothing, and Corvat sat all week among identical flasks with no dates or initials. That makes the shelf hard to trace; it does not show who seeded contamination. What does this shelf evidence actually support?';
  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });

  assert.equal(audit.exhibitHandoffVisible, true);
  assert.equal(audit.ok, true);
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

test('turning a lab flask under the bench light visibly presents a lab exhibit', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_unlabelled',
        via: 'tutor',
        surface: 'Devlin labels nothing, and Corvat spent the week among identical unmarked flasks.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const audit = auditTutorStubDramaticReleaseResponse({
    frame,
    text: 'I turn one of Devlin’s blank flasks under the bench light: no date, no initials, just a row beside Corvat all week. What does that establish—and no more?',
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.exhibitHandoffVisible, true);
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

test('Marrick assay handling counts as a visible exhibit release', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_metal',
        via: 'tutor',
        surface: 'The cupel shows poor dross: silver thinned with copper and a grey lead-sweat.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text =
    'I clear space beside the cupel and draw the shilling across the warmed touchstone. The streak shows poor dross. What does that change?';

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

test('the deterministic release fallback does not repeat the resolved source question', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_log',
        via: 'director',
        surface: 'The visitor log records a second badge in the noon window.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    responseConfiguration: { engagement_stance: 'plain', actorial_host_part: 'examiner' },
    variationKey: 'resolved-question-regression',
    avoidQuestion: 'What can we safely say from that?',
  });

  assert.doesNotMatch(text, /What can we safely say from that\?/u);
  assert.match(text, /\?/u);
});

test('the deterministic release fallback grounds Marrick action in the crucible rather than an abstract assay line', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'm_caster',
        via: 'director',
        surface:
          "The town has its founder ready: Verrell alone draws the mint-yard crucible, licensed to no one else since the old assay-master's day.",
        presentation: { mode: 'enacted_role', role: "town assayer voicing Marrick's ready verdict" },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    uptake: 'That is a fair question; I’ll answer it before we extend the case.',
    responseConfiguration: {
      engagement_stance: 'precise',
      actorial_host_part: 'examiner',
    },
    variationKey: 'marrick:t001',
  });

  assert.match(text, /I examine the crucible without carrying its claim beyond the evidence/u);
  assert.match(text, /“(?:I|My)\b/u);
  assert.match(text, /Verrell alone draws the mint-yard crucible/u);
  assert.doesNotMatch(text, /town has its founder ready/iu);
  assert.doesNotMatch(text, /tap the assay|test its line|my crucible records/iu);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('a presented Marrick assay is handled through its physical cupel with clean punctuation', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_alloy',
        via: 'tutor',
        surface:
          'The assay is plain in the cupel: these shillings are struck from poor dross, and grey lead-sweat catches on the touchstone.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    responseConfiguration: { engagement_stance: 'plain', actorial_host_part: 'examiner' },
    variationKey: 'marrick:alloy',
  });

  assert.match(text, /I examine the cupel:/u);
  assert.doesNotMatch(text, /examine the assay|\s+:/iu);
  assert.equal(auditTutorStubDramaticReleaseResponse({ text, frame }).ok, true);
});

test('Marrick founder testimony is voiced in first person rather than narrated', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crucible',
        via: 'tutor',
        surface:
          "The founder's man knows that dross by its lead-sweat: it answers to the leavings of the weir-forge crucible.",
        presentation: { mode: 'enacted_role', role: "founder's man identifying the lead-sweat" },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    responseConfiguration: { engagement_stance: 'warm', actorial_host_part: 'examiner' },
    variationKey: 'marrick:founder',
  });

  assert.match(text, /“[^”]*I know that dross by its lead-sweat/iu);
  assert.doesNotMatch(text, /The founder's man knows/iu);
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

test('a Marrick graver clue uses the graver as the fallback scene object', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'm_graver',
        via: 'director',
        surface: 'And Verrell engraves: the broad graver on Verrell’s bench is his alone.',
        presentation: { mode: 'enacted_role', role: 'guild officer describing Verrell’s bench' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    responseConfiguration: { engagement_stance: 'brisk', actorial_host_part: 'examiner' },
    variationKey: 'marrick:graver',
  });

  assert.match(text, /I examine the graver and go straight to the live line/u);
  assert.doesNotMatch(text, /:\s+And Verrell/iu);
  assert.match(text, /:\s+Verrell engraves/iu);
  assert.doesNotMatch(text, /examine the account/u);
});

test('a Marrick charcoal-book clue uses the book rather than the crucible as the fallback object', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_caster',
        via: 'director',
        surface:
          "The leat-keeper's book is exact. One hand alone has drawn the weir crucible and signed for its charcoal: Edony.",
        presentation: { mode: 'enacted_role', role: 'leat-keeper reading the charcoal book' },
      },
    ],
  });
  const text = deterministicTutorStubDramaticReleaseFallback({
    frame,
    responseConfiguration: { engagement_stance: 'warm', actorial_host_part: 'record_keeper' },
    variationKey: 'marrick:charcoal-book',
  });

  assert.match(text, /I mark the book in the open record/u);
  assert.doesNotMatch(text, /enter the crucible beside/u);
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

test('a source physically rubbing and holding an exhibit is a visible entrance but still needs first-person testimony', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crucible',
        via: 'director',
        surface: 'The dross answers to the leavings of the weir-forge crucible.',
        presentation: { mode: 'enacted_role', role: 'founder’s man reading the assay' },
      },
    ],
  });
  const text =
    'The founder’s man rubs the grey lead-sweat from a shilling onto the assay slip and holds it beside the crucible record. “This dross answers to the weir-forge.” What does that change?';
  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });

  assert.equal(audit.entranceVisible, true);
  assert.equal(audit.exhibitHandoffVisible, true);
  assert.deepEqual(audit.issues.map((issue) => issue.type), ['missing_in_scene_enactment']);
});

test('a where question visibly returns the released exhibit to the inquiry', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crucible',
        via: 'tutor',
        surface: 'The dross answers to the leavings of the weir-forge crucible.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text =
    'I hold the touchstone to the lamp and press the crucible scrap beside it. The grey lead-sweat answers to the weir-forge. Where, then, must these blanks have been cast?';
  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });

  assert.equal(audit.returnVisible, true);
  assert.equal(audit.ok, true);
});

test('a charismatic will-it-survive question returns the exhibit to the inquiry', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_alloy',
        via: 'tutor',
        surface: 'The cupel shows newly struck dross rather than clipped sterling.',
        presentation: { mode: 'presented_exhibit' },
      },
    ],
  });
  const text =
    'I examine the cupel against the room’s easy verdict: “The cupel shows newly struck dross rather than clipped sterling.” Will that line survive the case we were ready to make?';
  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });

  assert.equal(audit.returnVisible, true);
  assert.equal(audit.ok, true);
});

test('material assay handling makes a presented exhibit visible', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_crucible',
        via: 'tutor',
        surface: 'The dross answers to the leavings of the weir-forge crucible.',
        presentation: { mode: 'presented_exhibit', role: 'examiner' },
      },
    ],
  });
  const variants = [
    'I keep the lamp on the coin while the founder’s man rubs the grey lead-sweat between thumb and nail. What does that show about the crucible?',
    'I scrape the grey lead-sweat from the cupel into the founder’s man’s palm. What does that fix about the blanks?',
  ];

  for (const text of variants) {
    const audit = auditTutorStubDramaticReleaseResponse({ text, frame });
    assert.equal(audit.exhibitHandoffVisible, true, text);
    assert.equal(audit.ok, true, text);
  }
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

test('a whose-hand question returns an enacted record to the inquiry', () => {
  const frame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [
      {
        premise: 'p_caster',
        via: 'director',
        surface: 'Edony alone drew the weir crucible and signed for its charcoal.',
        presentation: { mode: 'enacted_role', role: 'leat-keeper reading the charcoal book' },
      },
    ],
  });
  const text =
    'I turn the charcoal book beneath the lamp; “I kept this book exact: Edony alone drew the weir crucible.” Whose hand, then, cast the blank?';

  const audit = auditTutorStubDramaticReleaseResponse({ text, frame });
  assert.equal(audit.returnVisible, true);
  assert.equal(audit.ok, true);
});
