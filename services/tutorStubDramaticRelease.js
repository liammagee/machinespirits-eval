export const TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA = 'machinespirits.tutor-stub.dramatic-release.v1';

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function releasePresentation(row = {}) {
  const authored = row.presentation && typeof row.presentation === 'object' ? row.presentation : {};
  const mode =
    authored.mode === 'enacted_role' || authored.mode === 'presented_exhibit'
      ? authored.mode
      : row.via === 'director'
        ? 'enacted_role'
        : 'presented_exhibit';
  return {
    mode,
    role: oneLine(authored.role || row.role || '') || null,
    cue: oneLine(authored.cue || row.cue || '') || null,
  };
}

function defaultRoleForSurface(surface = '') {
  const text = oneLine(surface).toLowerCase();
  if (/\b(?:log|ledger|book|archive|file|record|register|inventory|notice|entry|transcript|notebook)\b/u.test(text)) {
    return 'record-keeper';
  }
  if (/\b(?:watch|witness|saw|seen|heard|remembers?|swear|porter|keeper)\b/u.test(text)) return 'witness';
  if (/\b(?:assay|analyst|examiner|expert|guild|engineer|founder|sinker|chief)\b/u.test(text)) {
    return 'examiner';
  }
  return 'source of the clue';
}

export function buildTutorStubDramaticReleaseFrame({ dueEvidence = [] } = {}) {
  const entries = (Array.isArray(dueEvidence) ? dueEvidence : [dueEvidence])
    .filter((row) => oneLine(row?.surface))
    .map((row) => {
      const presentation = releasePresentation(row);
      return {
        premise: row.premise || null,
        via: row.via || null,
        surface: oneLine(row.surface),
        mode: presentation.mode,
        role: presentation.role || defaultRoleForSurface(row.surface),
        cue: presentation.cue,
      };
    });
  return {
    schema: TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
    active: entries.length > 0,
    entries,
    requiresEnactment: entries.some((entry) => entry.mode === 'enacted_role'),
    requiresExhibitHandoff: entries.some((entry) => entry.mode === 'presented_exhibit'),
  };
}

export function tutorStubDramaticReleasePrompt(frame = null) {
  if (!frame?.active) return '';
  const beats = frame.entries.map((entry, index) => {
    const label = frame.entries.length > 1 ? `Clue ${index + 1}` : 'Clue';
    if (entry.mode === 'enacted_role') {
      return [
        `${label}: ${entry.surface}`,
        `Enact it as: ${entry.role}.`,
        entry.cue ? `Authored entrance cue: ${entry.cue}` : null,
      ]
        .filter(Boolean)
        .join(' ');
    }
    return [
      `${label}: ${entry.surface}`,
      'Present it as a concrete exhibit, record, observation, or demonstration in the shared scene.',
      entry.cue ? `Authored entrance cue: ${entry.cue}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  });
  return [
    '[Tutor-only dramatic clue release]',
    'A new piece of public information enters in this reply. Make that transition audible instead of silently folding the clue into another question.',
    'Use three short beats:',
    '1. Handoff: tell the learner plainly that you are now bringing in, giving, showing, or testing another piece of information. Vary the wording naturally; do not recite a stock status line.',
    '2. Performance: stage the clue inside the drama. For an enacted role, explicitly invite the learner into the role-play, say whom you are becoming, and speak or read the clue from that position. For an exhibit, visibly put it on the table, open it, read it, show it, or demonstrate it.',
    '3. Return: step back into the shared inquiry and ask one light question about what this new information changes, supports, or rules out.',
    ...beats,
    'Do not add facts beyond the supplied clue. You may change person and phrasing for natural speech, but preserve its exact evidentiary content and uncertainty.',
    'Do not mention a release schedule, turn number, director, harness, prompt, DAG, premise id, or hidden evidence.',
    '[End tutor-only dramatic clue release]',
  ].join('\n');
}

const HANDOFF_PATTERN =
  /\b(?:another|new|next)\s+(?:piece of\s+)?(?:information|clue|evidence|exhibit|record|observation)|\b(?:i(?:'m| am)|we(?:'re| are))\s+(?:now\s+)?(?:going to\s+)?(?:bring|give|show|add|open|read|put|test)|\blet(?:'s| us)\s+(?:bring|take|put|open|read|look|role-play)/iu;
const ENACTMENT_PATTERN =
  /\b(?:role-play|play the (?:role|part)|i(?:'ll| will| am going to) be|i(?:'m| am) (?:now )?(?:the|your) (?:witness|clerk|record-keeper|examiner|expert|source)|speaking as|in the role of|let me be)\b/iu;
const EXHIBIT_PATTERN =
  /\b(?:put|place|lay|bring)\b[^.!?]{0,50}\b(?:table|before us|in front of us|evidence|exhibit|record|clue)\b|\b(?:open|read|show|examine|test|demonstrate|look at)\b/iu;
const RETURN_PATTERN =
  /\b(?:back to (?:us|the case|the question|our inquiry)|now,? what|what does (?:this|that)|what can (?:we|you)|what changes|what follows|what does it (?:change|show|support|rule out))\b[^?]*\?/iu;

export function auditTutorStubDramaticReleaseResponse({ text = '', frame = null } = {}) {
  if (!frame?.active) {
    return {
      schema: TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
      ok: true,
      active: false,
      handoffVisible: false,
      enactmentVisible: false,
      exhibitHandoffVisible: false,
      returnVisible: false,
      issues: [],
    };
  }
  const response = oneLine(text);
  const handoffVisible = HANDOFF_PATTERN.test(response);
  const enactmentVisible = ENACTMENT_PATTERN.test(response);
  const exhibitHandoffVisible = EXHIBIT_PATTERN.test(response);
  const returnVisible = RETURN_PATTERN.test(response);
  const issues = [];
  if (!handoffVisible) {
    issues.push({
      type: 'opaque_clue_release',
      reason: 'states a newly released clue without telling the learner that new information is entering the lesson',
    });
  }
  if (frame.requiresEnactment && !enactmentVisible) {
    issues.push({
      type: 'missing_in_scene_enactment',
      reason: 'narrates scene evidence from outside instead of explicitly taking the clue source’s role',
    });
  }
  if (frame.requiresExhibitHandoff && !exhibitHandoffVisible) {
    issues.push({
      type: 'missing_exhibit_action',
      reason: 'states an exhibit abstractly instead of visibly showing, reading, opening, testing, or placing it',
    });
  }
  if (!returnVisible) {
    issues.push({
      type: 'missing_return_to_inquiry',
      reason: 'does not step out of the clue performance and ask what the new information changes',
    });
  }
  return {
    schema: TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
    ok: issues.length === 0,
    active: true,
    handoffVisible,
    enactmentVisible,
    exhibitHandoffVisible,
    returnVisible,
    issues,
  };
}

export function deterministicTutorStubDramaticReleaseFallback({ frame = null, support = null } = {}) {
  if (!frame?.active) return '';
  const rendered = frame.entries.map((entry) => {
    if (entry.mode === 'enacted_role') {
      return `Let’s role-play it. I’ll take the part of ${entry.role}: “${entry.surface}”`;
    }
    return `I’ll put the next exhibit in front of us and read it aloud: “${entry.surface}”`;
  });
  const clarification = support?.clarificationInvitationRequired
    ? 'You can also ask me to unpack any word or connection in it.'
    : null;
  return [
    'I’m going to give you another piece of information now.',
    ...rendered,
    'Back to us: what does this new information change?',
    clarification,
  ]
    .filter(Boolean)
    .join(' ');
}
