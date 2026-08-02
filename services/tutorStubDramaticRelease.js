import { compileTutorStubDueSourceActionReferents, renderTutorStubDueSource } from './tutorStubDueSourceRenderer.js';
import { deterministicTutorStubTurnProgressionHandoff } from './tutorStubTurnProgressionContract.js';
import {
  TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
  TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA,
} from './tutorStubResponseContractSchemas.js';
import { tutorStubFirstPersonRoleVoiceVisible, tutorStubRoleStageDirectionVisible } from './tutorStubRoleVisibility.js';
import {
  TUTOR_STUB_SCENE_DICTION_PERIOD,
  resolveTutorStubSceneDiction,
  tutorStubDeclaredSceneObject,
  tutorStubDictionPhrase,
  tutorStubSceneStamp,
  tutorStubSceneLedgerTerm,
} from './tutorStubSceneDiction.js';

export { TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA } from './tutorStubResponseContractSchemas.js';
export { tutorStubFirstPersonRoleVoiceVisible, tutorStubRoleStageDirectionVisible } from './tutorStubRoleVisibility.js';

const CLUE_TOKEN_STOP_WORDS = new Set(
  'about after again also and are because before being between could does from had has have her him his into its just more not one only other our out over same she should some than that the their them then there these they this those through too under very was were what when where which while who will with would your'.split(
    ' ',
  ),
);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clueContentTokens(value) {
  return new Set(
    (
      oneLine(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []
    )
      .map((token) => token.replace(/[’']/gu, ''))
      .filter((token) => !CLUE_TOKEN_STOP_WORDS.has(token)),
  );
}

function sentenceRows(value) {
  return oneLine(value)
    .split(/(?<=[.!?])\s+|(?<=[.!?][”"'’])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function exactPassingCompensationTexts(sourceAccessibilityAudit = null) {
  const canonical =
    sourceAccessibilityAudit?.schema === TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA
      ? sourceAccessibilityAudit
      : sourceAccessibilityAudit?.source_accessibility;
  if (
    canonical?.schema !== TUTOR_STUB_SOURCE_ACCESSIBILITY_AUDIT_SCHEMA ||
    canonical.ok !== true ||
    canonical.effective_mode !== 'compensated' ||
    !canonical.spans?.compensation
  ) {
    return [];
  }
  const canonicalSpan = canonical.spans.compensation;
  const declaredSpans = Array.isArray(sourceAccessibilityAudit?.passing_compensation_spans)
    ? sourceAccessibilityAudit.passing_compensation_spans
    : Array.isArray(sourceAccessibilityAudit?.spans?.passing_compensations)
      ? sourceAccessibilityAudit.spans.passing_compensations
      : [
          {
            ...canonicalSpan,
            exact: true,
            ok: true,
          },
        ];
  const spans = declaredSpans;
  return spans
    .filter(
      (span) =>
        span?.ok === true &&
        span?.exact === true &&
        span.start === canonicalSpan.start &&
        span.end === canonicalSpan.end &&
        oneLine(span.text) === oneLine(canonicalSpan.text),
    )
    .map((span) => oneLine(span.text))
    .filter(Boolean);
}

function clueBearingSentenceMatches(text, surface, { exemptExactTexts = [] } = {}) {
  const responseSentences = sentenceRows(text);
  const clueSentences = sentenceRows(surface);
  if (!responseSentences.length || !clueSentences.length) return [];
  const remainingExemptions = [...exemptExactTexts];
  const candidateSentences = responseSentences.filter((sentence) => {
    const exactIndex = remainingExemptions.indexOf(sentence);
    if (exactIndex < 0) return true;
    // Only the exact passing compensation sentence is exempt. Consuming one
    // occurrence prevents a duplicate copy of that sentence from inheriting
    // the exemption merely because its words overlap the clue.
    remainingExemptions.splice(exactIndex, 1);
    return false;
  });
  // An authored clue may itself contain several sentences. Detect repeated
  // delivery of any one source sentence, rather than mistaking the clue's own
  // second sentence for a duplicate of its first.
  return (
    clueSentences
      .map((clueSentence) => {
        const clueTokens = clueContentTokens(clueSentence);
        if (!clueTokens.size) return [];
        const threshold = Math.max(3, Math.ceil(clueTokens.size * 0.45));
        return candidateSentences.filter((sentence) => {
          const sentenceTokens = clueContentTokens(sentence);
          let overlap = 0;
          for (const token of clueTokens) if (sentenceTokens.has(token)) overlap += 1;
          return overlap >= threshold;
        });
      })
      .sort((left, right) => right.length - left.length)[0] || []
  );
}

/**
 * Untangling 1, span replacement (card: harness-untangling-clue-insertion):
 * compose a delivered reply from a draft that paraphrases due clues. For
 * each due entry, the FIRST clue-bearing sentence (located by the same
 * matcher the duplicate guard uses) is replaced by the exact host-rendered
 * source; further bearing sentences are dropped; entries the draft never
 * touches are appended. Output is whitespace-normalized (sentence-level
 * recomposition).
 */
export function composeTutorStubClueSpanReplacement({ text = '', entries = [], renderedTexts = [] } = {}) {
  const sentences = sentenceRows(text);
  const consumed = new Array(sentences.length).fill(null);
  const appended = [];
  entries.forEach((entry, index) => {
    const renderedEntry = renderedTexts[index];
    const renderedText = typeof renderedEntry === 'string' ? renderedEntry : renderedEntry?.text || '';
    if (!renderedText) return;
    // Enacted-role sources must be anchored in their authored carrier (the
    // action-referent audit): host the speech with the carrier named.
    let rendered = renderedText;
    if (typeof renderedEntry === 'object') {
      const role = String(renderedEntry?.role || '').trim();
      const surface = String(renderedEntry?.surface || '').trim();
      const required = (renderedEntry?.action_referents?.referents || []).filter((row) => row.alignment_required);
      // The audit reads ONLY the last sentence before the exact source
      // occurrence (the pre-source host boundary), so the anchor must be its
      // own sentence directly ahead of the rendered text. Read role and
      // referents from the FRAME ENTRY (they live there — the rendered
      // object carries no role field; nine iterations of reading the wrong
      // object end here).
      const entryRole = String(entry?.role || role || '').trim();
      const entryRequired = (entry?.action_referents?.referents || [])
        .filter((row) => row.alignment_required)
        .concat(required);
      const anchor = entryRequired.length
        ? String(entryRequired[0].label || '').trim()
        : entryRole
          ? `the ${entryRole}`
          : '';
      if (anchor) {
        rendered = `I turn to ${anchor}. ${renderedText}`;
      }
    }
    // Union of bearing sentences across the clue's OWN sentences: the shared
    // matcher returns only the largest per-clue-sentence match set, which
    // leaves paraphrases of the clue's other sentences alive beside the
    // inserted exact text — the duplicate guard rightly rejects that.
    const union = new Set();
    for (const clueSentence of sentenceRows(entry?.surface || '')) {
      for (const match of clueBearingSentenceMatches(text, clueSentence)) union.add(match);
    }
    const matches = [...union];
    if (!matches.length) {
      appended.push(rendered);
      return;
    }
    let first = true;
    for (const match of matches) {
      const at = sentences.findIndex((sentence, j) => consumed[j] === null && sentence === match);
      if (at < 0) continue;
      consumed[at] = first ? rendered : 'drop';
      first = false;
    }
    if (first) appended.push(rendered);
  });
  const kept = sentences
    .map((sentence, j) => (consumed[j] === null ? sentence : consumed[j] === 'drop' ? null : consumed[j]))
    .filter(Boolean);
  return [...kept, ...appended].join(' ');
}

/**
 * Detect repeated delivery of evidence due in this response only. A later
 * turn may legitimately recall an already-public clue; this guard is scoped
 * to the active release frame so it cannot reject that ordinary restatement.
 */
export function auditTutorStubClueDeliveryMultiplicity({
  text = '',
  frame = null,
  sourceAccessibilityAudit = null,
} = {}) {
  if (!frame?.active) {
    return { ok: true, active: false, issues: [], repeatedEntries: [] };
  }
  const exemptExactTexts = exactPassingCompensationTexts(sourceAccessibilityAudit);
  const repeatedEntries = (frame.entries || [])
    .map((entry) => {
      const matches = clueBearingSentenceMatches(text, entry.surface, { exemptExactTexts });
      return {
        premise: entry.premise || null,
        surface: oneLine(entry.surface),
        bearingSentenceCount: matches.length,
        matches,
      };
    })
    .filter((entry) => entry.bearingSentenceCount > 1);
  const issues = repeatedEntries.map((entry) => ({
    type: 'duplicate_clue_delivery',
    reason: 'states the same newly released clue in more than one tutor sentence',
    premise: entry.premise,
    surface: entry.surface,
    bearingSentenceCount: entry.bearingSentenceCount,
    matches: entry.matches,
  }));
  return {
    ok: issues.length === 0,
    active: true,
    issues,
    repeatedEntries,
    exemptedPassingCompensations: exemptExactTexts,
  };
}

/**
 * Keep deterministic recovery idempotent when its learner-uptake sentence
 * overlaps a clue that must be delivered later in the same response. The
 * replacement acknowledges the learner without previewing, paraphrasing, or
 * duplicating the due public clue.
 */
export function prepareTutorStubDueClueUptake({ uptake = '', frame = null } = {}) {
  const source = oneLine(uptake);
  if (!source || !frame?.active) {
    return { text: source, replaced: false, repeatedPremises: [] };
  }
  const repeatedPremises = (frame.entries || [])
    .filter((entry) => clueBearingSentenceMatches(source, entry.surface).length > 0)
    .map((entry) => entry.premise || null)
    .filter(Boolean);
  if (!repeatedPremises.length) {
    return { text: source, replaced: false, repeatedPremises: [] };
  }
  return {
    text: 'Your proposed reading is the point this new public entry now tests.',
    replaced: true,
    repeatedPremises,
  };
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

export function buildTutorStubDramaticReleaseFrame({ dueEvidence = [], world = null } = {}) {
  // Resolved once per frame and stamped onto every entry, so consumers several
  // exported signatures downstream — including the three that receive an entry
  // through a bare `.map(renderTutorStubDueSource)` — can speak this world's
  // costume without a signature change. Omitting `world` yields the period
  // stamp, which is what every pre-existing caller and every recorded bundle
  // already behaves as.
  const scene = tutorStubSceneStamp(world);
  const entries = (Array.isArray(dueEvidence) ? dueEvidence : [dueEvidence])
    .filter((row) => oneLine(row?.surface))
    .map((row) => {
      const presentation = releasePresentation(row);
      const entry = {
        premise: row.premise || null,
        fact: Array.isArray(row.fact) ? [...row.fact] : null,
        via: row.via || null,
        surface: oneLine(row.surface),
        mode: presentation.mode,
        role: presentation.role || defaultRoleForSurface(row.surface),
        cue: presentation.cue,
        scene,
        action_referents: row.action_referents ?? row.presentation?.action_referents ?? null,
      };
      entry.action_referents = compileTutorStubDueSourceActionReferents(entry);
      return entry;
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
  /\b(?:bend(?:s|ing)?|bent|bring|check|clear|compare|demonstrate|dip|draw|enter|examine|hold(?:s|ing)?|held|inspect|keep|lay|lift|look at|open|peer|plant|place|pour|press|prise|pry|pull|put|read|rest|rub(?:s|bed|bing)?|run|scrape|set|show|slap|slide|smear(?:s|ed|ing)?|spread|steep(?:s|ed|ing)?|strike|tap|taste|test|tilt|tip|turn|unfold|warm|weigh)\b[^.!?]{0,80}\b(?:assay|audit|before us|book|card|chamber|chart|chest|clue|coin|contract|crucible|cup|cupel|dross|entry|evidence|exhibit|file|flasks?|gasket|history|in front of us|incubator|key|lamp|lead-sweat|leavings|ledger|line|lock|log|metal|notebook|notice|photo(?:graph)?|plate|printout|record|register|report|residue|sample|scratch|sequence|sheet|shilling|slate|spring|streak|swab|table|thornpick|tool|touchstone|trough|version|ward)\b/iu;
const EXHIBIT_ACTION_SOURCE =
  'bend|bring|carry|check|clear|compare|demonstrate|dip|draw|enter|examine|hold|inspect|keep|lay|lift|look|lower|open|peer|place|plant|point|pour|press|prise|pry|pull|put|read|rest|rub|run|scrape|set|show|slap|slide|smear|spread|steep|strike|tap|taste|test|tip|touch|trace|turn|unfold|warm|weigh';
const EXHIBIT_FRAME_TOKEN_STOP_WORDS = new Set(
  'about after again all among another because been before being does every everyone from have identical into labels line more nothing only other over same show shows showing spent story than that their them then there these they this those through under week were what when where which while with would'.split(
    ' ',
  ),
);
const RETURN_PATTERN =
  /\b(?:what|which|where|how|who|whose|does|do|can|could|will|would|is|are|has|have|should|your call)\b[^?]*\?|\b(?:choose|name|say|show|tell)\b[^.!?]{0,100}\b(?:change|changes|changed|mean|means|support|supports|rule out|rules out)\b/iu;

function factTermWords(value) {
  return oneLine(value)
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function quotedRoleSpeech(text = '') {
  const response = String(text || '');
  return [...response.matchAll(/“([^”]{0,1200})”/gu), ...response.matchAll(/"([^"\n]{0,1200})"/gu)]
    .map((match) => oneLine(match[1]))
    .filter((quote) => /\b(?:i|my|our|we)\b/iu.test(quote));
}

const ROLE_SPEECH_GROUNDING_STOP_WORDS = new Set(
  'about after again before book clue evidence exact from have into just only other record source than that their then there these they this those through under were what when where which while with would write'.split(
    ' ',
  ),
);

function quotedRoleEvidenceVisible(response, frame) {
  const quotes = quotedRoleSpeech(response);
  return (frame?.entries || [])
    .filter((entry) => entry.mode === 'enacted_role')
    .some((entry) => {
      const evidenceTokens = new Set(
        factTermWords(entry.surface).filter(
          (token) => token.length >= 4 && !ROLE_SPEECH_GROUNDING_STOP_WORDS.has(token),
        ),
      );
      if (!evidenceTokens.size) return false;
      const requiredMatches = Math.min(3, evidenceTokens.size);
      return quotes.some((quote) => {
        const quoteTokens = new Set(factTermWords(quote));
        return [...evidenceTokens].filter((token) => quoteTokens.has(token)).length >= requiredMatches;
      });
    });
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
        new RegExp(`${objectPattern.source}[^.!?;]{0,24}\\b(?:is|remains?|was|were)\\s+mine\\b`, 'iu').test(quote));
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
  return quotedRoleEvidenceVisible(response, frame);
}

function frameEvidenceTokens(frame) {
  return new Set(
    (frame?.entries || [])
      .filter((entry) => entry.mode === 'presented_exhibit')
      .flatMap(
        (entry) =>
          oneLine(entry.surface)
            .toLowerCase()
            .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || [],
      )
      .map((token) => token.replace(/[’']s$/u, '').replace(/[’']/gu, ''))
      .filter((token) => token.length >= 4 && !EXHIBIT_FRAME_TOKEN_STOP_WORDS.has(token)),
  );
}

function dynamicExhibitActionVisible(response, frame) {
  if (/\bpull(?:s|ed|ing)?\s+the room together\b/iu.test(response)) return false;
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
      new RegExp(`\\b(?:i|we)\\b[^.!?]{0,40}\\b(?:${EXHIBIT_ACTION_SOURCE})(?:s|ed|ing)?\\b[^.!?]{0,120}`, 'giu'),
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

export function auditTutorStubDramaticReleaseResponse({
  text = '',
  frame = null,
  sourceAccessibilityAudit = null,
} = {}) {
  if (!frame?.active) {
    return {
      schema: TUTOR_STUB_DRAMATIC_RELEASE_SCHEMA,
      ok: true,
      active: false,
      handoffVisible: false,
      enactmentVisible: false,
      exhibitHandoffVisible: false,
      returnVisible: false,
      clueDeliveryMultiplicity: { ok: true, active: false, issues: [], repeatedEntries: [] },
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
  const clueDeliveryMultiplicity = auditTutorStubClueDeliveryMultiplicity({
    text: response,
    frame,
    sourceAccessibilityAudit,
  });
  const issues = [];
  issues.push(...clueDeliveryMultiplicity.issues);
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
    clueDeliveryMultiplicity,
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
    (
      oneLine(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) || []
    ).filter((token) => !['about', 'does', 'from', 'that', 'this', 'what', 'which', 'with', 'would'].includes(token)),
  );
}

function questionOverlap(left, right) {
  const leftTokens = questionTokens(left);
  const rightTokens = questionTokens(right);
  if (!leftTokens.size || !rightTokens.size)
    return oneLine(left).toLowerCase() === oneLine(right).toLowerCase() ? 1 : 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function fallbackQuestion({ stance, variationKey, avoidQuestion = '' }) {
  const candidates = PERFORMANCE_QUESTIONS[stance];
  const start = stableVariantIndex(`${variationKey}:question`, candidates.length);
  const rotated = candidates.map((_, offset) => candidates[(start + offset) % candidates.length]);
  return rotated.find((candidate) => questionOverlap(candidate, avoidQuestion) < 0.55) || rotated[0];
}

function sceneObject(entry, fallback = 'record', world = null) {
  const text = oneLine(entry.surface);
  const role = oneLine(entry.role);
  const declaredSurfaceObject = tutorStubDeclaredSceneObject(text, world);
  if (declaredSurfaceObject) return declaredSurfaceObject;
  const surfaceObject = text.match(
    /\b(?:visitor badge log|badge log|lost-property ledger|trial-book|book|ledger|notice|register|notebook|call log|record|report|file|photograph|photo|crucible|coin|shilling|burin|cupel|die|graver|tool|sample|touchstone)\b/iu,
  )?.[0];
  if (surfaceObject) return surfaceObject;
  // Authored roles often name a physical record that their paraphrased clue
  // omits. Recover only those concrete record nouns here; broad role words
  // such as "assayer" must not turn into a fictitious object named "assay".
  const declaredRoleObject = tutorStubDeclaredSceneObject(role, world);
  if (declaredRoleObject) return declaredRoleObject;
  const roleObject = role.match(
    /\b(?:visitor badge log|badge log|lost-property ledger|trial-book|book|ledger|notice|register|notebook|call log|record|report|file)\b/iu,
  )?.[0];
  if (roleObject) return roleObject;
  // Nothing concrete was named. A contemporary world still has an authored word
  // for its evidence record; period worlds keep the frozen generic default.
  const ledgerTerm =
    resolveTutorStubSceneDiction(world) === TUTOR_STUB_SCENE_DICTION_PERIOD ? '' : tutorStubSceneLedgerTerm(world);
  return ledgerTerm || fallback;
}

const ROLE_VOICE_ENTRANCES = {
  plain: () => ['I can say this:', 'I can give you my account as stated:', 'Here is what I can attest:'],
  precise: () => ['I can certify no more than this:', 'My evidence has one exact limit:', 'I can attest only this:'],
  brisk: () => ['I will give it to you straight:', 'Here is my evidence:', 'I will state it plainly:'],
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
  const rawPart = oneLine(
    responseConfiguration?.actorial_host_part || responseConfiguration?.actorial_part || 'examiner',
  );
  const part =
    {
      cross_examiner: 'adversarial_teacher',
      opposing_counsel: 'exacting_schoolmaster',
    }[rawPart] || rawPart;
  return [
    'scene_partner',
    'examiner',
    'record_keeper',
    'advocate',
    'skeptic',
    'satirist',
    'adversarial_teacher',
    'exacting_schoolmaster',
    'foreperson',
  ].includes(part)
    ? part
    : 'examiner';
}

function hostEntrance(part, object, diction = TUTOR_STUB_SCENE_DICTION_PERIOD) {
  const phrase = (periodText, contemporaryText) => tutorStubDictionPhrase(diction, periodText, contemporaryText);
  return {
    scene_partner: phrase(`I set the ${object} between us`, `I put the ${object} where we can both see it`),
    examiner: phrase(`I examine the ${object}`, `I look at the ${object}`),
    record_keeper:
      object === 'record'
        ? phrase('I mark the live line in the open record', 'I write the live line down where we can both see it')
        : phrase(`I mark the ${object} in the open record`, `I write that line into the ${object}`),
    advocate: phrase(
      `I make the strongest case the ${object} can bear; test its limit`,
      `I will put the ${object} at its strongest; see where it stops holding`,
    ),
    skeptic: phrase(
      `Not so fast—I hold the claim against the ${object}`,
      `Hold on—I check that claim against the ${object}`,
    ),
    satirist: phrase(
      `I set the ${object} beside the polished claim and let its contradiction show`,
      `I set the ${object} next to the tidy version and let the gap show`,
    ),
    adversarial_teacher: phrase(
      `Let us test your idea with the ${object} as a counterexample: what changes, and how would you revise the idea`,
      `Let's test your idea against the ${object} as a counterexample: what changes, and how would you revise it`,
    ),
    exacting_schoolmaster: phrase(
      `Show the working with the ${object}: apply the method one step at a time, name what that step teaches us, then revise precisely`,
      `Show the working with the ${object}: take it one step at a time, say what each step tells us, then revise precisely`,
    ),
    foreperson: phrase(`I enter the ${object} as a provisional finding`, `I log the ${object} as a working finding`),
  }[part];
}

function stanceInflection(stance, diction = TUTOR_STUB_SCENE_DICTION_PERIOD) {
  const phrase = (periodText, contemporaryText) => tutorStubDictionPhrase(diction, periodText, contemporaryText);
  return {
    plain: '',
    precise: phrase('without carrying its claim beyond the evidence', 'without pushing its claim past the evidence'),
    brisk: phrase('and go straight to the live line', 'and go straight to the open question'),
    warm: phrase('where we can both read it', 'where we can both read it'),
    witnessing: phrase('and let its words stand without forcing them', 'and let it say what it says, no more'),
    charismatic: phrase("against the room's easy verdict", 'against the easy answer everyone already has'),
    ironic: phrase('at its apparently inconvenient line', 'at the line that turns out to be inconvenient'),
    sarcastic: phrase('at the nice trick the claim forgot', 'at the detail the claim quietly skipped'),
    face_threat: phrase('at the weak line we cannot refuse', 'at the weak spot we cannot skip'),
  }[stance];
}

function inflectedHost(part, object, stance, diction = TUTOR_STUB_SCENE_DICTION_PERIOD) {
  return [hostEntrance(part, object, diction), stanceInflection(stance, diction)].filter(Boolean).join(' ');
}

function sourceCarrierEntrance(entry) {
  const primary = entry?.action_referents?.primary;
  const label = oneLine(primary?.alignment_required === false ? '' : primary?.label);
  if (!label) return '';
  const alreadyDetermined = /^(?:a|an|the)\b/iu.test(label);
  const possessiveOrProper = /(?:[’']s\b)|^[\p{Lu}\d]/u.test(label);
  const article = alreadyDetermined || possessiveOrProper ? '' : 'the ';
  return `I call for ${article}${label}`;
}

function compensationWordCount(value) {
  return oneLine(value).match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length || 0;
}

/**
 * Produce a conservative extractive candidate for deterministic recovery.
 * This helper grants no delivery privilege: the live source-accessibility
 * audit must still accept the exact post-SOURCE sentence before it can be
 * shown. Prefer the authored clause after a colon and remove only a bounded
 * comma-delimited appositive; otherwise use the shortest complete authored
 * clause that fits the frozen budget.
 */
export function deterministicTutorStubSourceAccessibilityCompensation(contract = null) {
  if (
    contract?.effective_mode !== 'compensated' ||
    contract?.compensation_contract_ready !== true ||
    contract?.compensation?.owner !== 'post_source_sentence'
  ) {
    return '';
  }
  const maximum = Number(contract.compensation.max_words || 0);
  let authored = oneLine(contract.compensation.source_text)
    .replace(/^[“"]|[”"]$/gu, '')
    .trim();
  const reportingPrefix = authored.match(/^I\b[^:]{0,100}:\s*(.+)$/iu);
  if (reportingPrefix) authored = reportingPrefix[1].trim();
  const candidates = [];
  const colonTail = authored.match(/:\s*([^:]+)$/u)?.[1]?.trim();
  if (colonTail) candidates.push(colonTail);
  candidates.push(authored);
  for (const candidate of [...candidates]) {
    const withoutAppositive = candidate.replace(/^([^,]{1,48}),\s*[^,]{1,120},\s*/u, '$1 ');
    if (withoutAppositive !== candidate) candidates.unshift(withoutAppositive);
  }
  const complete = candidates
    .map((candidate) =>
      candidate
        .trim()
        .replace(/[;,:\s]+$/u, '')
        .replace(/[!?]+$/u, '.'),
    )
    .map((candidate) => (/[.]$/u.test(candidate) ? candidate : `${candidate}.`))
    .filter((candidate) => compensationWordCount(candidate) >= 4)
    .filter((candidate) => !maximum || compensationWordCount(candidate) <= maximum)
    .sort((left, right) => compensationWordCount(left) - compensationWordCount(right));
  return complete[0] || '';
}

function renderEnactedEntry(entry, { stance, hostPart, index, compensation = '', world = null, diction }) {
  const object = sceneObject(entry, 'account', world);
  const source = renderTutorStubDueSource(entry, index);
  const entrance = [sourceCarrierEntrance(source), inflectedHost(hostPart, object, stance, diction), source.text]
    .filter(Boolean)
    .join('; ');
  return [entrance, compensation].filter(Boolean).join(' ');
}

function renderExhibitEntry(entry, { stance, hostPart, index, compensation = '', world = null, diction }) {
  const object = sceneObject(entry, 'record', world);
  const source = renderTutorStubDueSource(entry, index);
  const host = [sourceCarrierEntrance(source), inflectedHost(hostPart, object, stance, diction)]
    .filter(Boolean)
    .join('; ');
  return [`${host}: ${source.text}`, compensation].filter(Boolean).join(' ');
}

export function deterministicTutorStubDramaticReleaseFallback({
  frame = null,
  support = null,
  uptake = '',
  responseConfiguration = null,
  variationKey = '',
  avoidQuestion = '',
  turnProgressionContract = null,
  sourceAccessibilityContract = null,
  world = null,
} = {}) {
  if (!frame?.active) return '';
  const diction = resolveTutorStubSceneDiction(world);
  const stance = fallbackStance(responseConfiguration);
  const hostPart = fallbackHostPart(responseConfiguration);
  const compensation = deterministicTutorStubSourceAccessibilityCompensation(sourceAccessibilityContract);
  const compensationSourceId = sourceAccessibilityContract?.compensation?.source_id || null;
  const rendered = frame.entries.map((entry, index) =>
    entry.mode === 'enacted_role'
      ? renderEnactedEntry(entry, {
          stance,
          hostPart,
          variationKey,
          index,
          compensation: !compensationSourceId || compensationSourceId === `source_${index + 1}` ? compensation : '',
          world,
          diction,
        })
      : renderExhibitEntry(entry, {
          stance,
          hostPart,
          variationKey,
          index,
          compensation: !compensationSourceId || compensationSourceId === `source_${index + 1}` ? compensation : '',
          world,
          diction,
        }),
  );
  const clarification = support?.clarificationInvitationRequired
    ? 'You can also ask me to unpack any word or connection in it.'
    : null;
  const directRepair =
    support?.responsiveRepairRequired && !oneLine(uptake)
      ? 'You’re right—I did not answer your question directly. The public record that answers it is this:'
      : null;
  const development = [
    directRepair,
    ...rendered,
    deterministicTutorStubTurnProgressionHandoff({
      contract: turnProgressionContract,
      support,
      defaultQuestion: fallbackQuestion({ stance, variationKey, avoidQuestion }),
      publicObject: sceneObject(frame.entries[0], 'record', world),
    }),
    turnProgressionContract?.handoff_contract?.question_allowed === false ? null : clarification,
  ]
    .filter(Boolean)
    .join(' ');
  return [oneLine(uptake), development].filter(Boolean).join(' ');
}
