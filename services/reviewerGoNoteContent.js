/**
 * Content checks for a reviewer GO note, shared by the paid-run gates in the
 * adaptive-warrant runners.
 *
 * Why this exists. The edged-register runner matched /\bGO\b/ anywhere in the
 * note text, which every draft's own title satisfies, so a note headed
 * "DRAFT FOR HUMAN REVIEW — NOT SIGNED" passed the gate (commit 22dbbc31).
 * The same weak token sat in the three warrant gates. Two of those pin one
 * exact committed path and compare its bytes against HEAD, so the token was
 * decoration there; the pinned path is the gate. The pilot gate pins only the
 * relay directory, so the token WAS the gate — and eight committed notes
 * satisfied it, five of them Codex reports, a reviewer direction, and the
 * relay STATE.md, whose matching line records a registered NO-GO.
 *
 * The edged fix does not transfer verbatim. It requires GO on a line of its
 * own; none of the six signed warrant notes is written that way. The rules
 * below are the ones all six signed notes do satisfy:
 *
 *   docs/adaptation-refinement/relay/063a-reviewer-go-note-outcome-pilot.md
 *   .../069b-reviewer-go-note-outcome-pilot-corrected.md
 *   .../073a-reviewer-go-note-outcome-pilot-v3.md
 *   .../083a-reviewer-go-note-outcome-pilot-v4.md
 *   .../097a-reviewer-go-note-main-block.md
 *   .../103-reviewer-go-note-steering-decomposition.md
 *
 * The adaptive-warrant arc is closed (paper §6.25, workplan item
 * adaptive-warrant-outcome-study: "No further paid run is authorized under
 * this arc"). Nothing here changes a run artifact, a manifest, a pinned SHA
 * or a cited note. It only narrows what a future launch would accept.
 */

/** A note that is still a draft says so at the top. Same markers as the edged fix. */
export const GO_NOTE_DRAFT_MARKERS = /DRAFT FOR HUMAN REVIEW|NOT SIGNED|unsigned draft/iu;

/** The reviewer names a GO note this way; reports, directions and STATE.md do not. */
export const REVIEWER_GO_NOTE_FILENAME = /(?:^|\/)[^/]*reviewer-go-note[^/]*\.md$/u;

/** Does the file name announce a reviewer GO note? */
export function isReviewerGoNoteFilename(relativePath) {
  return REVIEWER_GO_NOTE_FILENAME.test(String(relativePath || ''));
}

/** First line with something on it — the note's own title. */
export function goNoteTitleLine(content) {
  for (const line of String(content || '').split('\n')) {
    if (line.trim()) return line.trim();
  }
  return '';
}

/** Everything after the title line. The title is a label; this is the note. */
export function goNoteBody(content) {
  const lines = String(content || '').split('\n');
  const titleIndex = lines.findIndex((line) => line.trim());
  return titleIndex === -1 ? '' : lines.slice(titleIndex + 1).join('\n');
}

/**
 * Does the title say this document is a GO note? Stops a Codex report, a
 * reviewer direction or a status file from standing in for a signature.
 */
export function titleAnnouncesGoNote(content) {
  return /\bGO note\b/iu.test(goNoteTitleLine(content));
}

/**
 * Does the note carry a GO that is not a NO-GO? "NO-GO" contains the word GO,
 * hyphen included, because the hyphen is a word boundary. Strip those first,
 * then look for the bare token. \bGO\b already rejects ALGO and GOAL; the
 * plain substring test the two block runners used did not.
 */
export function hasBareGoToken(content) {
  return /\bGO\b/u.test(String(content || '').replace(/\bNO[-\s]?GO\b/giu, ''));
}

/**
 * Full content check for a reviewer GO note. Returns every failure, not the
 * first, so the refusal message names each missing thing.
 */
export function checkReviewerGoNoteContent(content, { label = 'go note' } = {}) {
  const errors = [];
  const text = String(content || '');
  if (GO_NOTE_DRAFT_MARKERS.test(text)) errors.push(`${label} still carries its draft banner — it is not signed`);
  if (!titleAnnouncesGoNote(text)) errors.push(`${label} title does not announce it as a GO note`);
  // Read the body, not the whole text. The title check above requires the
  // phrase "GO note", which itself carries a bare GO — testing the whole text
  // would repeat that check under a second name instead of asking a second
  // question. All six signed notes say GO below their title.
  if (!hasBareGoToken(goNoteBody(text))) {
    errors.push(`${label} does not say GO below its title (a registered NO-GO does not count)`);
  }
  return { ok: errors.length === 0, errors };
}

/** Throw the caller's refusal when the content check fails. */
export function assertReviewerGoNoteContent(content, { label = 'go note', refusal = 'refuses' } = {}) {
  const check = checkReviewerGoNoteContent(content, { label });
  if (!check.ok) throw new Error(`${refusal}: ${check.errors.join('; ')}`);
  return check;
}
