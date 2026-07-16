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

function inferredPresentationMode(row = {}) {
  const surface = oneLine(row.surface).toLowerCase();
  const role = oneLine(row.role).toLowerCase();
  const documentLike =
    /\b(?:archive|badge|book|card|chart|file|history|inventory|ledger|log|notebook|notice|photo(?:graph)?|record|register|report|sequence|sheet|swab|transcript|version)\b/u.test(
      surface,
    );
  const witnessLike =
    /\b(?:attest|heard|remembers?|reported|saw|seen|swear|testif(?:y|ied)|watch(?:ed|man)?|witness)\b/u.test(
      `${surface} ${role}`,
    );
  if (documentLike && !witnessLike) return 'presented_exhibit';
  if (witnessLike) return 'enacted_role';
  return row.via === 'director' ? 'enacted_role' : 'presented_exhibit';
}

function releasePresentation(row = {}) {
  const authored = row.presentation && typeof row.presentation === 'object' ? row.presentation : {};
  const mode =
    authored.mode === 'enacted_role' || authored.mode === 'presented_exhibit'
      ? authored.mode
      : inferredPresentationMode(row);
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
        fact: Array.isArray(row.fact) ? [...row.fact] : null,
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
    '2. Performance: for an enacted role, speak its evidence inside quotation marks. After the tutor-host entrance, begin the source quotation itself with a first-person reporting act such as “I saw,” “I read,” “I know,” or “I attest.” First person belongs to that reporting act only: preserve every named actor, owner, family relation, and possession in the supplied evidence. Never print the source role outside the quotation, write “as the assayer/officer/clerk speaks or says,” prefix the speech with the role name, or insert a third-person stage direction. For an exhibit, handle it directly in the existing tutor voice. Never say “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” or otherwise describe the acting from outside it.',
    '3. Handoff: keep the learner in that same continuous performance with one light interpretive question about what the clue changes, supports, or rules out. Do not say “back to us” or “back to the case.”',
    ...beats,
    'Do not add facts beyond the supplied clue. You may change only the reporting frame and ordinary phrasing for natural speech; never move a named person’s deed, custody, relationship, or possession onto the reporting source.',
    'Do not mention a release schedule, turn number, director, harness, prompt, DAG, premise id, or hidden evidence.',
    '[End tutor-only dramatic clue release]',
  ].join('\n');
}

const META_ROLEPLAY_PATTERN =
  /\b(?:let(?:[’']s| us)\s+role-play|role-play it|play the (?:role|part)|i(?:[’']ll| will)\s+(?:be|become|play|take the part)|i(?:[’']m| am)\s+going to be|speaking as|in the role of|let me be)\b/iu;
const META_RELEASE_PATTERN =
  /\b(?:i(?:[’']m| am)\s+going to give you another piece of information|i(?:[’']m| am)\s+bringing in another clue|another piece of information (?:is|will be) entering|back to (?:us|the case))\b/iu;
const EXHIBIT_PATTERN =
  /\b(?:bend(?:s|ing)?|bent|bring|check|clear|compare|demonstrate|dip|draw|enter|examine|hold(?:s|ing)?|held|inspect|keep|lay|lift|look at|open|peer|plant|place|pour|press|prise|pry|put|read|rest|rub(?:s|bed|bing)?|run|scrape|set|show|slap|slide|smear(?:s|ed|ing)?|spread|steep(?:s|ed|ing)?|strike|tap|taste|test|tilt|tip|turn|unfold|warm|weigh)\b[^.!?]{0,80}\b(?:assay|audit|before us|book|card|chamber|chart|chest|clue|coin|contract|crucible|cup|cupel|dross|entry|evidence|exhibit|file|flasks?|gasket|history|in front of us|incubator|key|lamp|lead-sweat|leavings|ledger|line|lock|log|metal|notebook|notice|photo(?:graph)?|plate|printout|record|register|report|residue|sample|scratch|sequence|sheet|shilling|slate|spring|streak|swab|table|thornpick|tool|touchstone|trough|version|ward)\b/iu;
const EXHIBIT_ACTION_SOURCE =
  'bend|bring|carry|check|clear|compare|demonstrate|dip|draw|enter|examine|hold|inspect|keep|lay|lift|look|lower|open|peer|place|plant|point|pour|press|prise|pry|pull|put|read|rest|rub|run|scrape|set|show|slap|slide|smear|spread|steep|strike|tap|taste|test|tip|touch|trace|turn|unfold|warm|weigh';
const EXHIBIT_FRAME_TOKEN_STOP_WORDS = new Set(
  'about after again all among another because been before being does every everyone from have identical into labels line more nothing only other over same show shows showing spent story than that their them then there these they this those through under week were what when where which while with would'.split(
    ' ',
  ),
);
const RETURN_PATTERN =
  /\b(?:what|which|where|how|who|whose|does|do|can|could|will|would|is|are|has|have|should|your call)\b[^?]*\?/iu;

function roleIdentity(entry) {
  return oneLine(entry?.role).split(
    /\b(?:attesting|describing|giving|holding|identifying|opening|presenting|reading|reporting|showing|testifying|unfolding|voicing|witnessing)\b/iu,
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
  const unquotedResponse = response.replace(/“[^”]*”/gu, ' ').replace(/"[^"\n]*"/gu, ' ');
  return (frame?.entries || [])
    .filter((entry) => entry.mode === 'enacted_role')
    .some((entry) => {
      const pattern = roleIdentityPattern(entry);
      if (!pattern) return false;
      return new RegExp(`\\b(?:the\\s+)?${pattern}\\b`, 'iu').test(unquotedResponse);
    });
}

export function tutorStubFirstPersonRoleVoiceVisible(text = '') {
  const response = oneLine(text);
  return /(?:“[^”]{0,900}\b(?:i|we|my|our)\b[^”]{0,900}”|"[^"]{0,900}\b(?:i|we|my|our)\b[^"]{0,900}")/iu.test(
    response,
  );
}

function factTermWords(value) {
  return oneLine(value)
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function quotedRoleSpeech(text = '') {
  const response = String(text || '');
  return [
    ...(response.matchAll(/“([^”]{0,1200})”/gu)),
    ...(response.matchAll(/"([^"\n]{0,1200})"/gu)),
  ]
    .map((match) => oneLine(match[1]))
    .filter((quote) => /\b(?:i|my|our|we)\b/iu.test(quote));
}

function entrySourcePerspectiveDrift(entry, response) {
  const fact = Array.isArray(entry?.fact) ? entry.fact : [];
  const predicate = oneLine(fact[0]);
  if (!['soleCasterAt', 'soleHolderOf'].includes(predicate)) return false;
  const actorWords = factTermWords(fact.at(-1));
  const role = oneLine(entry?.role).toLowerCase();
  if (actorWords.length && actorWords.every((word) => role.includes(word))) return false;
  const objectWords = factTermWords(fact[1]);
  const objectHead = objectWords.at(-1);
  const objectPattern = objectHead
    ? new RegExp(`\\b${objectHead.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'iu')
    : null;
  return quotedRoleSpeech(response).some((quote) => {
    const selfSoleAction =
      /\bi\s+alone\s+(?:cast|draw|drew|handle|handled|hold|held|keep|kept|own|owned|use|used|work|worked)\b/iu.test(
        quote,
      );
    const reassignedRelation = /\bmy\s+(?:hand|keeping|possession|widow)\b/iu.test(quote);
    const selfOwnedObject =
      objectPattern &&
      (new RegExp(`\\bmy\\b[^.!?;]{0,35}${objectPattern.source}`, 'iu').test(quote) ||
        new RegExp(`${objectPattern.source}[^.!?;]{0,24}\\b(?:is|remains?|was|were)\\s+mine\\b`, 'iu').test(
          quote,
        ));
    return selfSoleAction || reassignedRelation || selfOwnedObject;
  });
}

export function tutorStubSourcePerspectiveDriftVisible({ text = '', frame = null } = {}) {
  const response = oneLine(text);
  return (frame?.entries || [])
    .filter((entry) => entry.mode === 'enacted_role')
    .some((entry) => entrySourcePerspectiveDrift(entry, response));
}

function directEnactmentVisible(response, frame) {
  if (META_ROLEPLAY_PATTERN.test(response)) return false;
  if (tutorStubRoleStageDirectionVisible({ text: response, frame })) return false;
  return tutorStubFirstPersonRoleVoiceVisible(response);
}

function frameEvidenceTokens(frame) {
  return new Set(
    (frame?.entries || [])
      .filter((entry) => entry.mode === 'presented_exhibit')
      .flatMap((entry) => oneLine(entry.surface).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [])
      .map((token) => token.replace(/[’']s$/u, '').replace(/[’']/gu, ''))
      .filter((token) => token.length >= 4 && !EXHIBIT_FRAME_TOKEN_STOP_WORDS.has(token)),
  );
}

function dynamicExhibitActionVisible(response, frame) {
  if (EXHIBIT_PATTERN.test(response)) return true;
  if (
    /\b(?:archive|book|card|chart|file|history|ledger|log|notebook|notice|photo(?:graph)?|record|register|report|sequence|sheet|swab|transcript|version)\b[^.!?]{0,35}\b(?:arrives?|drops?|lands?|lies?|opens?|rests?|sits?)\b|\b(?:arrives?|drops?|lands?|lies?|opens?|rests?|sits?)\b[^.!?]{0,35}\b(?:archive|book|card|chart|file|history|ledger|log|notebook|notice|photo(?:graph)?|record|register|report|sequence|sheet|swab|transcript|version)\b/iu.test(
      response,
    )
  ) {
    return true;
  }
  const evidenceTokens = frameEvidenceTokens(frame);
  if (!evidenceTokens.size) return false;
  const clauses =
    response.match(
      new RegExp(
        `\\b(?:i|we)\\b[^.!?]{0,40}\\b(?:${EXHIBIT_ACTION_SOURCE})(?:s|ed|ing)?\\b[^.!?]{0,120}`,
        'giu',
      ),
    ) || [];
  return clauses.some((clause) => {
    const clauseTokens = new Set(
      (clause.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []).map((token) =>
        token.replace(/[’']s$/u, '').replace(/[’']/gu, ''),
      ),
    );
    return [...evidenceTokens].some((token) => clauseTokens.has(token));
  });
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
  const sourcePerspectiveDrift = tutorStubSourcePerspectiveDriftVisible({ text: response, frame });
  const firstPersonRoleVoice = tutorStubFirstPersonRoleVoiceVisible(response);
  const enactmentVisible = directEnactmentVisible(response, frame);
  const exhibitHandoffVisible = dynamicExhibitActionVisible(response, frame);
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
  if (sourcePerspectiveDrift) {
    issues.push({
      type: 'source_perspective_drift',
      reason: 'moves a named actor’s deed, custody, or possession onto the reporting source’s first person',
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
    sourcePerspectiveDrift,
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

function questionTokens(value) {
  return new Set(
    (oneLine(value).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []).filter(
      (token) => !['about', 'does', 'from', 'that', 'this', 'what', 'which', 'with', 'would'].includes(token),
    ),
  );
}

function questionOverlap(left, right) {
  const leftTokens = questionTokens(left);
  const rightTokens = questionTokens(right);
  if (!leftTokens.size || !rightTokens.size) return oneLine(left).toLowerCase() === oneLine(right).toLowerCase() ? 1 : 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function fallbackQuestion({ stance, variationKey, avoidQuestion = '' }) {
  const candidates = PERFORMANCE_QUESTIONS[stance];
  const start = stableVariantIndex(`${variationKey}:question`, candidates.length);
  const rotated = candidates.map((_, offset) => candidates[(start + offset) % candidates.length]);
  return rotated.find((candidate) => questionOverlap(candidate, avoidQuestion) < 0.55) || rotated[0];
}

function sceneObject(entry, fallback = 'record') {
  const text = oneLine(entry.surface);
  const surfaceObject = text.match(
    /\b(?:visitor badge log|badge log|lost-property ledger|trial-book|book|ledger|notice|register|notebook|call log|record|report|file|photograph|photo|crucible|coin|shilling|burin|cupel|die|graver|tool|sample|touchstone)\b/iu,
  )?.[0];
  if (surfaceObject) return surfaceObject;
  // Authored roles often name a physical record that their paraphrased clue
  // omits. Recover only those concrete record nouns here; broad role words
  // such as "assayer" must not turn into a fictitious object named "assay".
  return (
    oneLine(entry.role).match(
      /\b(?:visitor badge log|badge log|lost-property ledger|trial-book|book|ledger|notice|register|notebook|call log|record|report|file)\b/iu,
    )?.[0] || fallback
  );
}

const ROLE_VOICE_ENTRANCES = {
  plain: () => [
    'I can say this:',
    'I can give you my account as stated:',
    'Here is what I can attest:',
  ],
  precise: () => [
    'I can certify no more than this:',
    'My evidence has one exact limit:',
    'I can attest only this:',
  ],
  brisk: () => [
    'I will give it to you straight:',
    'Here is my evidence:',
    'I will state it plainly:',
  ],
  warm: () => [
    'I can put my account plainly between us:',
    'Here is what I can honestly tell you:',
    'I can offer this much:',
  ],
  witnessing: () => [
    'I can let my words stand as given:',
    'I will not force my account beyond this:',
    'I can honestly testify to no more than this:',
  ],
  charismatic: () => [
    "My evidence contradicts the room's easy verdict:",
    'I will put my account against the obvious story:',
    'My testimony challenges the easy answer:',
  ],
  ironic: () => [
    'My account has an apparently inconvenient line:',
    'I can supply the conveniently overlooked evidence:',
    'My testimony makes the neat story not exactly so neat:',
  ],
  sarcastic: () => [
    'My account has a conveniently awkward line:',
    'I can show you the nice trick the claim forgot:',
    'My testimony contains the apparently optional evidence:',
  ],
  face_threat: () => [
    'My evidence exposes the weak line:',
    'I will put my account against the failed claim:',
    'My testimony gives us the line we cannot refuse:',
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

function fallbackHostPart(responseConfiguration) {
  const part = oneLine(
    responseConfiguration?.actorial_host_part || responseConfiguration?.actorial_part || 'examiner',
  );
  return ['scene_partner', 'examiner', 'record_keeper', 'advocate', 'skeptic', 'foreperson'].includes(part)
    ? part
    : 'examiner';
}

function hostEntrance(part, object) {
  return {
    scene_partner: `I set the ${object} between us`,
    examiner: `I examine the ${object}`,
    record_keeper: `I mark the ${object} in the open record`,
    advocate: `I make the strongest case the ${object} can bear; test its limit`,
    skeptic: `Not so fast—I hold the claim against the ${object}`,
    foreperson: `I enter the ${object} as a provisional finding`,
  }[part];
}

function stanceInflection(stance) {
  return {
    plain: '',
    precise: 'without carrying its claim beyond the evidence',
    brisk: 'and go straight to the live line',
    warm: 'where we can both read it',
    witnessing: 'and let its words stand without forcing them',
    charismatic: "against the room's easy verdict",
    ironic: 'at its apparently inconvenient line',
    sarcastic: 'at the nice trick the claim forgot',
    face_threat: 'at the weak line we cannot refuse',
  }[stance];
}

function spokenSourceSurface(surface) {
  // Authored clue prose may continue a curriculum paragraph with a connective
  // such as "And". Once voiced as a fresh witness statement, that connective
  // becomes an audible splice. Some clues also begin with narrative casting
  // ("The town has its founder ready:"); that belongs to the director, not in
  // the source's mouth. Preserve the evidence after that narrow setup frame.
  return oneLine(surface)
    .replace(/^(?:and|but|so|then)\s+/iu, '')
    .replace(/^the founder[’']s man knows\b/iu, 'I know')
    .replace(
      /^(?:the town has (?:its|the) [^:]{0,60} ready|the (?:record|report) (?:says|shows)|the [^:]{1,45} reports?)\s*:\s*/iu,
      '',
    );
}

function inflectedHost(part, object, stance) {
  return [hostEntrance(part, object), stanceInflection(stance)].filter(Boolean).join(' ');
}

function renderEnactedEntry(entry, { stance, hostPart, variationKey, index }) {
  const object = sceneObject(entry, 'account');
  const entrances = ROLE_VOICE_ENTRANCES[stance](object);
  const entrance = entrances[stableVariantIndex(`${variationKey}:${index}:entrance`, entrances.length)];
  return `${inflectedHost(hostPart, object, stance)}; “${entrance} ${spokenSourceSurface(entry.surface)}”`;
}

function renderExhibitEntry(entry, { stance, hostPart }) {
  const object = sceneObject(entry);
  return `${inflectedHost(hostPart, object, stance)}: “${entry.surface}”`;
}

export function deterministicTutorStubDramaticReleaseFallback({
  frame = null,
  support = null,
  uptake = '',
  responseConfiguration = null,
  variationKey = '',
  avoidQuestion = '',
} = {}) {
  if (!frame?.active) return '';
  const stance = fallbackStance(responseConfiguration);
  const hostPart = fallbackHostPart(responseConfiguration);
  const rendered = frame.entries.map((entry, index) =>
    entry.mode === 'enacted_role'
      ? renderEnactedEntry(entry, { stance, hostPart, variationKey, index })
      : renderExhibitEntry(entry, { stance, hostPart, variationKey, index }),
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
    fallbackQuestion({ stance, variationKey, avoidQuestion }),
    clarification,
  ]
    .filter(Boolean)
    .join(' ');
  return [oneLine(uptake), development].filter(Boolean).join(' ');
}
