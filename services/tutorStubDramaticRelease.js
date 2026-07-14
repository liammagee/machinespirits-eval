export const TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA = 'machinespirits.tutor-stub.dramatic-release.v1';

const ROLE_TOKEN_STOP_WORDS = new Set(
  'about after another before being from into reading role source that their them these this with'.split(
    ' ',
  ),
);

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
        `Enact it from inside this role: ${entry.role}. Speak the clue in the role's first person inside quotation marks.`,
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
    'A new piece of public information enters in the development part of this reply. Make its arrival audible or visible inside the scene instead of explaining the tutoring machinery.',
    'Fold three short movements into the same continuous reply and voice:',
    '1. Entrance: let a character, object, interruption, gesture, or spoken line bring the new information into the scene. Do not announce that you are giving “another piece of information” or “bringing in another clue.”',
    '2. Performance: for an enacted role, speak its evidence in first person inside quotation marks. Do not prefix the speech with the role name or a stage direction. For an exhibit, handle it directly in the existing tutor voice. Never say “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” or otherwise describe the acting from outside it.',
    '3. Handoff: keep the learner in that same continuous performance with one light interpretive question about what the clue changes, supports, or rules out. Do not say “back to us” or “back to the case.”',
    ...beats,
    'Do not add facts beyond the supplied clue. You may change person and phrasing for natural speech, but preserve its exact evidentiary content and uncertainty.',
    'Do not mention a release schedule, turn number, director, harness, prompt, DAG, premise id, or hidden evidence.',
    '[End tutor-only dramatic clue release]',
  ].join('\n');
}

const META_ROLEPLAY_PATTERN =
  /\b(?:let(?:[’']s| us)\s+role-play|role-play it|play the (?:role|part)|i(?:[’']ll| will)\s+(?:be|become|play|take the part)|i(?:[’']m| am)\s+going to be|speaking as|in the role of|let me be)\b/iu;
const META_RELEASE_PATTERN =
  /\b(?:i(?:[’']m| am)\s+going to give you another piece of information|i(?:[’']m| am)\s+bringing in another clue|another piece of information (?:is|will be) entering|back to (?:us|the case))\b/iu;
const EXHIBIT_PATTERN =
  /\b(?:bring|demonstrate|draw|examine|hold|lay|look at|open|plant|place|put|read|rest|set|show|slap|slide|strike|tap|test|turn|unfold)\b[^.!?]{0,80}\b(?:assay|before us|book|clue|entry|evidence|exhibit|file|in front of us|ledger|line|log|notebook|notice|record|register|report|sample|table|tool)\b/iu;
const RETURN_PATTERN =
  /\b(?:what|which|does|do|can|your call)\b[^?]*\?/iu;

function roleIdentity(entry) {
  return oneLine(entry?.role).split(
    /\b(?:reading|holding|opening|showing|presenting|voicing|reporting|testifying|unfolding|describing|giving)\b/iu,
  )[0].trim();
}

function roleIdentityPattern(entry) {
  const identity = roleIdentity(entry);
  if (!identity) return null;
  const tokens = (identity.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).filter(
    (token) => !ROLE_TOKEN_STOP_WORDS.has(token.toLowerCase()),
  );
  if (!tokens.length) return null;
  return tokens
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/[-‐‑‒–—]/gu, '[-\\s]'))
    .join('(?:[-\\s]+|,\\s*)');
}

export function tutorStubRoleStageDirectionVisible({ text = '', frame = null } = {}) {
  const response = oneLine(text);
  return (frame?.entries || [])
    .filter((entry) => entry.mode === 'enacted_role')
    .some((entry) => {
      const pattern = roleIdentityPattern(entry);
      if (!pattern) return false;
      return new RegExp(`(?:^|[.!?]\\s+)(?:the\\s+)?${pattern}\\b[^.!?]{0,140}(?::|—)`, 'iu').test(
        response,
      );
    });
}

export function tutorStubFirstPersonRoleVoiceVisible(text = '') {
  const response = oneLine(text);
  return /(?:“[^”]{0,900}\b(?:i|we|my|our)\b[^”]{0,900}”|"[^"]{0,900}\b(?:i|we|my|our)\b[^"]{0,900}")/iu.test(
    response,
  );
}

function directEnactmentVisible(response, frame) {
  if (META_ROLEPLAY_PATTERN.test(response)) return false;
  if (tutorStubRoleStageDirectionVisible({ text: response, frame })) return false;
  return tutorStubFirstPersonRoleVoiceVisible(response);
}

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
  const metaRoleplayAnnouncement = META_ROLEPLAY_PATTERN.test(response);
  const metaReleaseAnnouncement = META_RELEASE_PATTERN.test(response);
  const roleStageDirection = tutorStubRoleStageDirectionVisible({ text: response, frame });
  const firstPersonRoleVoice = tutorStubFirstPersonRoleVoiceVisible(response);
  const enactmentVisible = directEnactmentVisible(response, frame);
  const exhibitHandoffVisible = EXHIBIT_PATTERN.test(response);
  const entranceVisible = enactmentVisible || exhibitHandoffVisible;
  const handoffVisible = entranceVisible;
  const returnVisible = RETURN_PATTERN.test(response);
  const issues = [];
  if (metaRoleplayAnnouncement || metaReleaseAnnouncement) {
    issues.push({
      type: 'meta_dramatic_announcement',
      reason: 'announces the clue release or role-play from outside the scene instead of enacting it',
    });
  }
  if (roleStageDirection) {
    issues.push({
      type: 'role_label_stage_direction',
      reason: 'introduces the clue with a role label or stage direction instead of speaking from inside the role',
    });
  }
  if (!entranceVisible) {
    issues.push({
      type: 'opaque_clue_release',
      reason: 'states a newly released clue without a character, object, gesture, or spoken entrance inside the scene',
    });
  }
  if (frame.requiresEnactment && !enactmentVisible) {
    issues.push({
      type: 'missing_in_scene_enactment',
      reason: 'does not voice the clue source directly in first person inside the scene',
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
      reason: 'does not keep the learner in the clue performance with a question about what changes',
    });
  }
  return {
    schema: TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
    ok: issues.length === 0,
    active: true,
    entranceVisible,
    handoffVisible,
    enactmentVisible,
    exhibitHandoffVisible,
    returnVisible,
    metaRoleplayAnnouncement,
    metaReleaseAnnouncement,
    roleStageDirection,
    firstPersonRoleVoice,
    issues,
  };
}

function stableVariantIndex(value, length) {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % length;
}

function sceneObject(entry, fallback = 'record') {
  const text = `${oneLine(entry.role)} ${oneLine(entry.surface)}`;
  return (
    text.match(
      /\b(?:visitor badge log|badge log|lost-property ledger|trial-book|ledger|notice|register|notebook|call log|record|report|file|photograph|photo|assay|tool|sample)\b/iu,
    )?.[0] || fallback
  );
}

const ROLE_VOICE_ENTRANCES = {
  plain: (object) => [
    `My ${object} records this:`,
    `I can give you the ${object} entry as written:`,
    `Here is what I entered in my ${object}:`,
  ],
  precise: (object) => [
    `The exact line in my ${object} reads—and it proves no more than this:`,
    `My ${object} records one exact limit:`,
    `I can certify only this line from my ${object}:`,
  ],
  brisk: (object) => [
    `My ${object} has the live line:`,
    `Here is the live entry in my ${object}:`,
    `I will give it to you straight from my ${object}:`,
  ],
  warm: (object) => [
    `Here is the line we can read together in my ${object}:`,
    `My ${object} gives us this line between us:`,
    `I can put the ${object} entry plainly between us:`,
  ],
  witnessing: (object) => [
    `I can let my ${object} stand as written:`,
    `I will not force my ${object} beyond this entry:`,
    `I can honestly testify to no more than my ${object} says:`,
  ],
  charismatic: (object) => [
    `My ${object} contradicts the room's easy verdict:`,
    `I will put my ${object} against the obvious story:`,
    `The line in my ${object} challenges the easy answer:`,
  ],
  ironic: (object) => [
    `My ${object} has an apparently inconvenient line:`,
    `I can supply the conveniently overlooked entry in my ${object}:`,
    `My ${object} makes the neat story not exactly so neat:`,
  ],
  sarcastic: (object) => [
    `My ${object} has a conveniently awkward line:`,
    `I can show you the nice trick the claim forgot in my ${object}:`,
    `My ${object} contains the apparently optional evidence:`,
  ],
  face_threat: (object) => [
    `My ${object} exposes the weak line:`,
    `I will put my ${object} against the failed claim:`,
    `My ${object} gives us the line we cannot refuse:`,
  ],
};

const PERFORMANCE_QUESTIONS = {
  plain: ['What does that show?', 'What changes now?', 'What can we safely say from that?'],
  precise: [
    'What does that establish—and no more?',
    'Which conclusion does that line support, and which does it not?',
    'What is licensed by that exact entry?',
  ],
  brisk: ['Your call: what changes?', 'What does that add?', 'Where does that move the case?'],
  warm: ['What do you make of it?', 'What can we carry forward together?', 'How does that change your reading?'],
  witnessing: [
    'What can we responsibly carry from that?',
    'What does the line let us say without forcing it?',
    'What judgment can that evidence honestly bear?',
  ],
  charismatic: [
    'Does that break the easy verdict, or not?',
    'What happens to the obvious story now?',
    'Will that line survive the case we were ready to make?',
  ],
  ironic: [
    'Apparently the easy claim has company now—what changes?',
    'Conveniently overlooked; what does it do to the neat story?',
    'Not exactly the simple case we had—what survives?',
  ],
  sarcastic: [
    'Nice trick for the weak claim—what survives the entry?',
    'Apparently evidence was optional; what does the line actually prove?',
    'Conveniently awkward. What changes now?',
  ],
  face_threat: [
    'Choose: what does it prove?',
    'Stop there—what part of the claim is weak?',
    'Answer now: what survives this line?',
  ],
};

function fallbackStance(responseConfiguration) {
  const stance = oneLine(responseConfiguration?.engagement_stance || responseConfiguration?.selected_register);
  return ROLE_VOICE_ENTRANCES[stance] ? stance : 'plain';
}

function renderEnactedEntry(entry, { stance, variationKey, index }) {
  const object = sceneObject(entry, 'account');
  const entrances = ROLE_VOICE_ENTRANCES[stance](object);
  const entrance = entrances[stableVariantIndex(`${variationKey}:${index}:entrance`, entrances.length)];
  return `“${entrance} ${entry.surface}”`;
}

function renderExhibitEntry(entry, { stance, variationKey, index }) {
  const object = sceneObject(entry);
  const actions = {
    plain: [`I open the ${object} between us`, `I turn the ${object} toward us`, `I read from the ${object}`],
    precise: [`I turn the ${object} to its exact line`, `I open the ${object} at the relevant line`],
    brisk: [`I turn the ${object} straight to the live line`, `I open the ${object} at the live line`],
    warm: [`I open the ${object} between us`, `I read the ${object} where we can both see it`],
    witnessing: [`I open the ${object} and let its line stand`, `I read the ${object} without pressing a verdict`],
    charismatic: [`I open the ${object} at the line that challenges the easy story`, `I turn the ${object} on the obvious verdict`],
    ironic: [`I open the ${object} on its apparently inconvenient line`, `I turn the ${object} to its conveniently overlooked entry`],
    sarcastic: [`I open the ${object} on the nice trick the claim forgot`, `I open the ${object} to its conveniently awkward line`],
    face_threat: [`I open the ${object} at the weak line`, `I turn the ${object} beside the failed claim`],
  }[stance];
  const action = actions[stableVariantIndex(`${variationKey}:${index}:exhibit`, actions.length)];
  return `${action}: “${entry.surface}”`;
}

export function deterministicTutorStubDramaticReleaseFallback({
  frame = null,
  support = null,
  uptake = '',
  responseConfiguration = null,
  variationKey = '',
} = {}) {
  if (!frame?.active) return '';
  const stance = fallbackStance(responseConfiguration);
  const rendered = frame.entries.map((entry, index) =>
    entry.mode === 'enacted_role'
      ? renderEnactedEntry(entry, { stance, variationKey, index })
      : renderExhibitEntry(entry, { stance, variationKey, index }),
  );
  const clarification = support?.clarificationInvitationRequired
    ? 'You can also ask me to unpack any word or connection in it.'
    : null;
  const directRepair = support?.responsiveRepairRequired && !oneLine(uptake)
    ? 'You’re right—I did not answer your question directly. The public record that answers it is this:'
    : null;
  const development = [
    directRepair,
    ...rendered,
    PERFORMANCE_QUESTIONS[stance][
      stableVariantIndex(`${variationKey}:question`, PERFORMANCE_QUESTIONS[stance].length)
    ],
    clarification,
  ]
    .filter(Boolean)
    .join(' ');
  return [oneLine(uptake), development].filter(Boolean).join(' ');
}
